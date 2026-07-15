import { access, constants } from 'node:fs/promises';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import type { ApiCapabilities, ApiErrorResponse, ServerOperationKind } from '@pdflover/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { forwardOpenRouterChat } from './ai/openrouter.js';
import { readCapabilities, requiredEnginesReady } from './capabilities.js';
import type { ApiConfig } from './config.js';
import { loadConfig } from './config.js';
import { ApiError } from './errors.js';
import { executeServerOperation } from './engine/index.js';
import { JobStore } from './jobs/job-store.js';
import { JobScheduler } from './jobs/scheduler.js';
import { FixedWindowRateLimiter } from './rate-limit.js';

interface AppOptions {
  config?: ApiConfig;
  jobStore?: JobStore;
  capabilities?: () => Promise<ApiCapabilities>;
  logger?: boolean;
  executeOperation?: typeof executeServerOperation;
}

const OPERATION_KINDS = new Set<ServerOperationKind>([
  'pdf.encrypt',
  'pdf.decrypt',
  'pdf.secure-redact',
  'pdf.digital-sign',
  'pdf.ocr',
  'pdf.convert.docx',
  'pdf.convert.xlsx',
  'pdf.convert.pptx',
  'pdf.compress.lossy',
]);

function parseOperation(operation: unknown): ServerOperationKind {
  if (typeof operation !== 'string' || !OPERATION_KINDS.has(operation as ServerOperationKind)) {
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'A supported operation identifier is required',
    });
  }
  return operation as ServerOperationKind;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger: options.logger ?? false,
    // Digital signing includes a PDF plus a bounded 10 MiB PKCS#12 archive.
    bodyLimit: config.maxUploadBytes + 12 * 1_048_576,
    requestIdHeader: 'x-request-id',
  });
  const jobs = options.jobStore ?? new JobStore({
    root: config.tempRoot,
    ttlMs: config.artifactTtlMs,
    cleanupIntervalMs: config.cleanupIntervalMs,
  });
  const capabilities = options.capabilities ?? (() => readCapabilities(config));
  const executeOperation = options.executeOperation ?? executeServerOperation;
  const scheduler = new JobScheduler(config.globalConcurrency, config.clientConcurrency);
  jobs.setExpiryHandler((jobId) => {
    scheduler.cancel(jobId);
  });
  const jobRateLimit = new FixedWindowRateLimiter(30, 60_000);
  const aiRateLimit = new FixedWindowRateLimiter(30, 60_000);

  await jobs.initialize();
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError({
        statusCode: 403,
        code: 'BAD_REQUEST',
        message: 'Origin is not allowed',
      }), false);
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  });
  await app.register(multipart, {
    limits: {
      files: 2,
      fields: 4,
      fileSize: config.maxUploadBytes,
      fieldSize: 16_384,
    },
    throwFileSizeLimit: false,
  });

  app.setErrorHandler((error, request, reply) => {
    const known = error instanceof ApiError;
    const statusCode = known ? error.statusCode : 500;
    const response: ApiErrorResponse = {
      error: {
        requestId: request.id,
        code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'The server could not complete the request',
        retryable: known ? error.retryable : false,
        details: known ? error.details : undefined,
      },
    };
    if (!known) request.log.error({ err: error }, 'unhandled request error');
    reply.status(statusCode).send(response);
  });

  app.get('/api/v1/health/live', async () => ({ status: 'ok' as const }));

  app.get('/api/v1/health/ready', async (_request, reply) => {
    let runtime: ApiCapabilities;
    try {
      await access(config.tempRoot, constants.R_OK | constants.W_OK | constants.X_OK);
      runtime = await capabilities();
    } catch {
      reply.status(503);
      return { status: 'not_ready' as const, reason: 'temporary job storage is unavailable' };
    }
    if (!requiredEnginesReady(runtime)) {
      reply.status(503);
      return {
        status: 'not_ready' as const,
        reason: 'one or more required PDF engines are unavailable',
      };
    }
    return { status: 'ready' as const };
  });

  app.get('/api/v1/capabilities', async () => capabilities());

  app.post<{ Querystring: { operation?: string } }>('/api/v1/jobs', async (request, reply) => {
    jobRateLimit.assertAllowed(request.ip);
    const operation = parseOperation(request.query.operation);
    const runtime = await capabilities();
    const capability = runtime.operations.find((candidate) => candidate.kind === operation);
    if (!capability?.available) {
      throw new ApiError({
        statusCode: 503,
        code: 'ENGINE_UNAVAILABLE',
        message: capability?.unavailableReason ?? 'Required runtime engine is unavailable',
        retryable: true,
      });
    }
    const job = await jobs.create(operation);
    try {
      let storedInput: Awaited<ReturnType<JobStore['storeInput']>> | undefined;
      let storedCertificate: Awaited<ReturnType<JobStore['storeCertificate']>> | undefined;
      let operationOptions: unknown = {};
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (part.fieldname === 'certificate') {
            if (operation !== 'pdf.digital-sign') {
              part.file.resume();
              throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'A certificate is only accepted for digital signing' });
            }
            if (storedCertificate) {
              part.file.resume();
              throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'Only one PKCS#12 certificate is allowed' });
            }
            if (!['application/x-pkcs12', 'application/pkcs12', 'application/octet-stream'].includes(part.mimetype)) {
              part.file.resume();
              throw new ApiError({ statusCode: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Certificate must be a PKCS#12 .p12 or .pfx file' });
            }
            storedCertificate = await jobs.storeCertificate(job.id, {
              filename: part.filename,
              stream: part.file,
            });
            continue;
          }
          if (part.fieldname !== 'file') {
            part.file.resume();
            throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: `Unexpected file field: ${part.fieldname}` });
          }
          if (storedInput) {
            part.file.resume();
            throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'Only one PDF file is allowed' });
          }
          if (!['application/pdf', 'application/octet-stream'].includes(part.mimetype)) {
            part.file.resume();
            throw new ApiError({
              statusCode: 415,
              code: 'UNSUPPORTED_MEDIA_TYPE',
              message: 'The uploaded file must be a PDF',
            });
          }
          storedInput = await jobs.storeInput(job.id, {
            filename: part.filename,
            stream: part.file,
            maxBytes: config.maxUploadBytes,
          });
          if (part.file.truncated) {
            throw new ApiError({
              statusCode: 413,
              code: 'FILE_TOO_LARGE',
              message: `PDF exceeds the ${config.maxUploadBytes} byte upload limit`,
            });
          }
        } else if (part.fieldname === 'options') {
          if (typeof part.value !== 'string') {
            throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'options must be JSON text' });
          }
          try {
            operationOptions = JSON.parse(part.value);
          } catch {
            throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'options contains invalid JSON' });
          }
        }
      }
      if (!storedInput) {
        throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'A PDF file is required' });
      }
      if (operation === 'pdf.digital-sign' && !storedCertificate) {
        throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'A PKCS#12 certificate is required' });
      }

      scheduler.enqueue(job.id, request.ip, async (signal) => {
        try {
          jobs.update(job.id, 'running', { progress: { percentage: 5, stage: 'Starting document engine' } });
          const result = await executeOperation({
            operation,
            inputPath: storedInput.path,
            inputFilename: storedInput.filename,
            certificatePath: storedCertificate?.path,
            options: operationOptions,
            timeoutMs: config.processTimeoutMs,
            signal,
          });
          if (signal.aborted) return;
          jobs.update(job.id, 'running', { progress: { percentage: 90, stage: 'Storing artifact' } });
          await jobs.storeArtifact(job.id, result);
          jobs.update(job.id, 'succeeded', { progress: { percentage: 100, stage: 'Complete' } });
        } catch (error) {
          let current: ReturnType<JobStore['get']>;
          try {
            current = jobs.get(job.id);
          } catch {
            return;
          }
          if (current.status === 'cancelled') return;
          const known = error instanceof ApiError;
          jobs.update(job.id, 'failed', {
            progress: { percentage: current.progress.percentage, stage: 'Failed' },
            error: {
              code: known ? error.code : 'INTERNAL_ERROR',
              message: known ? error.message : 'The server could not complete the PDF operation',
              retryable: known ? error.retryable : false,
            },
          });
        } finally {
          await Promise.all([
            jobs.deleteInput(job.id, storedInput.path).catch(() => undefined),
            storedCertificate
              ? jobs.deleteInput(job.id, storedCertificate.path).catch(() => undefined)
              : Promise.resolve(),
          ]);
        }
      });
      reply.status(202);
      return jobs.get(job.id);
    } catch (error) {
      await jobs.delete(job.id);
      throw error;
    }
  });

  app.get<{ Params: { id: string } }>('/api/v1/jobs/:id', async (request) =>
    jobs.get(request.params.id),
  );

  app.get<{ Params: { id: string } }>('/api/v1/jobs/:id/events', async (request, reply) => {
    const initial = jobs.get(request.params.id);
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (job: typeof initial) => {
      reply.raw.write(`event: job\ndata: ${JSON.stringify(job)}\n\n`);
    };
    send(initial);
    const unsubscribe = jobs.subscribe(request.params.id, send);
    const heartbeat = setInterval(() => reply.raw.write(': keep-alive\n\n'), 15_000);
    heartbeat.unref();
    request.raw.once('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.delete<{ Params: { id: string } }>('/api/v1/jobs/:id', async (request, reply) => {
    const job = jobs.get(request.params.id);
    if (job.status === 'queued' || job.status === 'running') {
      scheduler.cancel(request.params.id);
      reply.status(200);
      return jobs.cancel(request.params.id);
    }
    await jobs.delete(request.params.id);
    reply.status(204).send();
  });

  app.get<{ Params: { id: string; artifactId: string } }>(
    '/api/v1/jobs/:id/artifacts/:artifactId',
    async (request, reply) => {
      const result = await jobs.readArtifact(request.params.id, request.params.artifactId);
      reply
        .header('Content-Type', result.artifact.mediaType)
        .header('Content-Length', String(result.artifact.size))
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(result.artifact.filename)}`,
        )
        .header('X-Content-SHA256', result.artifact.sha256)
        .send(result.data);
    },
  );

  app.delete<{ Params: { id: string; artifactId: string } }>(
    '/api/v1/jobs/:id/artifacts/:artifactId',
    async (request, reply) => {
      await jobs.deleteArtifact(request.params.id, request.params.artifactId);
      reply.status(204).send();
    },
  );

  app.post('/api/v1/ai/chat', async (request, reply) => {
    aiRateLimit.assertAllowed(request.ip);
    await forwardOpenRouterChat(request, reply, config);
  });

  app.addHook('onClose', async () => {
    scheduler.close();
    jobs.close();
  });

  return app;
}
