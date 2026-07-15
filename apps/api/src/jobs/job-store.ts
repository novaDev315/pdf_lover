import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type {
  OperationArtifact,
  OperationError,
  OperationJob,
  OperationProgress,
  OperationStatus,
  ServerOperationKind,
} from '@pdflover/shared';
import { ApiError, notFound } from '../errors.js';

type JobListener = (job: OperationJob) => void;

const TERMINAL_STATUSES = new Set<OperationStatus>([
  'succeeded',
  'failed',
  'cancelled',
  'expired',
]);

function cloneJob(job: OperationJob): OperationJob {
  return structuredClone(job);
}

export class JobStore {
  readonly root: string;
  private readonly ttlMs: number;
  private readonly jobs = new Map<string, OperationJob>();
  private readonly artifactPaths = new Map<string, Map<string, string>>();
  private readonly listeners = new Map<string, Set<JobListener>>();
  private readonly cleanupTimer: NodeJS.Timeout;
  private expiryHandler?: (jobId: string) => void;

  constructor(options: { root: string; ttlMs: number; cleanupIntervalMs: number }) {
    this.root = resolve(options.root);
    this.ttlMs = options.ttlMs;
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpired().catch(() => undefined);
    }, options.cleanupIntervalMs);
    this.cleanupTimer.unref();
  }

  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
  }

  close(): void {
    clearInterval(this.cleanupTimer);
  }

  setExpiryHandler(handler: (jobId: string) => void): void {
    this.expiryHandler = handler;
  }

  private contained(path: string): string {
    const absolute = resolve(path);
    const fromRoot = relative(this.root, absolute);
    if (fromRoot === '' || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== '..')) {
      return absolute;
    }
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Resolved path is outside the temporary job root',
    });
  }

  private directory(jobId: string): string {
    if (!/^[0-9a-f-]{36}$/.test(jobId)) {
      throw new ApiError({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Invalid job identifier',
      });
    }
    return this.contained(resolve(this.root, jobId));
  }

  async create(operation: ServerOperationKind): Promise<OperationJob> {
    const now = new Date();
    const id = randomUUID();
    const job: OperationJob = {
      id,
      operation,
      status: 'queued',
      progress: { percentage: 0, stage: 'Queued' },
      artifacts: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
    };
    await mkdir(this.directory(id), { recursive: false, mode: 0o700 });
    this.jobs.set(id, job);
    this.artifactPaths.set(id, new Map());
    return cloneJob(job);
  }

  get(jobId: string): OperationJob {
    const job = this.jobs.get(jobId);
    if (!job) throw notFound('job');
    return cloneJob(job);
  }

  listActiveForOperation(operation: ServerOperationKind): OperationJob[] {
    return [...this.jobs.values()]
      .filter((job) => job.operation === operation && !TERMINAL_STATUSES.has(job.status))
      .map(cloneJob);
  }

  update(
    jobId: string,
    status: OperationStatus,
    options: { progress?: OperationProgress; error?: OperationError } = {},
  ): OperationJob {
    const job = this.jobs.get(jobId);
    if (!job) throw notFound('job');
    if (TERMINAL_STATUSES.has(job.status)) {
      throw new ApiError({
        statusCode: 409,
        code: 'CONFLICT',
        message: `Cannot transition a ${job.status} job`,
      });
    }
    job.status = status;
    job.updatedAt = new Date().toISOString();
    if (options.progress) job.progress = options.progress;
    if (options.error) job.error = options.error;
    this.emit(job);
    return cloneJob(job);
  }

  async storeArtifact(
    jobId: string,
    input: { filename: string; mediaType: string; data: Uint8Array },
  ): Promise<OperationArtifact> {
    const job = this.jobs.get(jobId);
    if (!job) throw notFound('job');

    const safeFilename = basename(input.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safeFilename || safeFilename === '.' || safeFilename === '..') {
      throw new ApiError({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Artifact filename is invalid',
      });
    }

    const id = randomUUID();
    const path = this.contained(resolve(this.directory(jobId), `${id}-${safeFilename}`));
    await writeFile(path, input.data, { mode: 0o600, flag: 'wx' });
    const file = await stat(path);
    const artifact: OperationArtifact = {
      id,
      filename: safeFilename,
      mediaType: input.mediaType,
      size: file.size,
      sha256: createHash('sha256').update(input.data).digest('hex'),
      createdAt: new Date().toISOString(),
    };
    job.artifacts.push(artifact);
    job.updatedAt = new Date().toISOString();
    this.artifactPaths.get(jobId)?.set(id, path);
    this.emit(job);
    return structuredClone(artifact);
  }

  async storeInput(
    jobId: string,
    input: { filename: string; stream: Readable; maxBytes: number },
  ): Promise<{ path: string; filename: string; size: number }> {
    if (!this.jobs.has(jobId)) throw notFound('job');
    const safeFilename = basename(input.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safeFilename || safeFilename === '.' || safeFilename === '..') {
      throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'Input filename is invalid' });
    }
    const path = this.contained(resolve(this.directory(jobId), `input-${safeFilename}`));
    let size = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.byteLength;
        if (size > input.maxBytes) {
          callback(new ApiError({
            statusCode: 413,
            code: 'FILE_TOO_LARGE',
            message: `PDF exceeds the ${input.maxBytes} byte upload limit`,
          }));
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      await pipeline(input.stream, limit, createWriteStream(path, { flags: 'wx', mode: 0o600 }));
      if (size === 0) {
        throw new ApiError({ statusCode: 400, code: 'INVALID_PDF', message: 'Uploaded PDF is empty' });
      }
      const handle = await open(path, 'r');
      try {
        const header = Buffer.alloc(5);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        if (bytesRead !== 5 || header.toString('ascii') !== '%PDF-') {
          throw new ApiError({
            statusCode: 400,
            code: 'INVALID_PDF',
            message: 'Uploaded file does not contain a PDF header',
          });
        }
      } finally {
        await handle.close();
      }
      return { path, filename: safeFilename, size };
    } catch (error) {
      await rm(path, { force: true });
      throw error;
    }
  }

  async storeCertificate(
    jobId: string,
    input: { filename: string; stream: Readable; maxBytes?: number },
  ): Promise<{ path: string; filename: string; size: number }> {
    if (!this.jobs.has(jobId)) throw notFound('job');
    const safeFilename = basename(input.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safeFilename || safeFilename === '.' || safeFilename === '..') {
      throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'Certificate filename is invalid' });
    }
    const path = this.contained(resolve(this.directory(jobId), `certificate-${safeFilename}`));
    const maxBytes = input.maxBytes ?? 10 * 1024 * 1024;
    let size = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.byteLength;
        if (size > maxBytes) {
          callback(new ApiError({
            statusCode: 413,
            code: 'FILE_TOO_LARGE',
            message: `PKCS#12 certificate exceeds the ${maxBytes} byte limit`,
          }));
          return;
        }
        callback(null, chunk);
      },
    });
    try {
      await pipeline(input.stream, limit, createWriteStream(path, { flags: 'wx', mode: 0o600 }));
      if (size === 0) {
        throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'PKCS#12 certificate is empty' });
      }
      const handle = await open(path, 'r');
      try {
        const header = Buffer.alloc(1);
        const { bytesRead } = await handle.read(header, 0, 1, 0);
        if (bytesRead !== 1 || header[0] !== 0x30) {
          throw new ApiError({
            statusCode: 400,
            code: 'BAD_REQUEST',
            message: 'Certificate does not contain a DER-encoded PKCS#12 archive',
          });
        }
      } finally {
        await handle.close();
      }
      return { path, filename: safeFilename, size };
    } catch (error) {
      await rm(path, { force: true });
      throw error;
    }
  }

  async readArtifact(
    jobId: string,
    artifactId: string,
  ): Promise<{ artifact: OperationArtifact; data: Buffer }> {
    const job = this.jobs.get(jobId);
    if (!job) throw notFound('job');
    const artifact = job.artifacts.find((candidate) => candidate.id === artifactId);
    const path = this.artifactPaths.get(jobId)?.get(artifactId);
    if (!artifact || !path) throw notFound('artifact');
    return { artifact: structuredClone(artifact), data: await readFile(this.contained(path)) };
  }

  async deleteInput(jobId: string, inputPath: string): Promise<void> {
    const directory = this.directory(jobId);
    const path = this.contained(inputPath);
    const fromDirectory = relative(directory, path);
    if (fromDirectory.startsWith(`..${sep}`) || fromDirectory === '..' || fromDirectory === '') {
      throw new ApiError({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Input path is outside the job directory',
      });
    }
    await rm(path, { force: true });
  }

  async deleteArtifact(jobId: string, artifactId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw notFound('job');
    const path = this.artifactPaths.get(jobId)?.get(artifactId);
    const index = job.artifacts.findIndex((artifact) => artifact.id === artifactId);
    if (!path || index < 0) throw notFound('artifact');
    await rm(this.contained(path), { force: true });
    job.artifacts.splice(index, 1);
    job.updatedAt = new Date().toISOString();
    this.artifactPaths.get(jobId)?.delete(artifactId);
    this.emit(job);
  }

  async cancel(jobId: string): Promise<OperationJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw notFound('job');
    if (job.status === 'cancelled') return cloneJob(job);
    if (TERMINAL_STATUSES.has(job.status)) {
      throw new ApiError({
        statusCode: 409,
        code: 'CONFLICT',
        message: `Cannot cancel a ${job.status} job`,
      });
    }
    job.status = 'cancelled';
    job.progress = { ...job.progress, stage: 'Cancelled' };
    job.updatedAt = new Date().toISOString();
    job.error = {
      code: 'JOB_CANCELLED',
      message: 'Job was cancelled',
      retryable: false,
    };
    await rm(this.directory(jobId), { recursive: true, force: true });
    job.artifacts = [];
    this.artifactPaths.set(jobId, new Map());
    this.emit(job);
    return cloneJob(job);
  }

  async delete(jobId: string): Promise<void> {
    if (!this.jobs.has(jobId)) throw notFound('job');
    await rm(this.directory(jobId), { recursive: true, force: true });
    this.jobs.delete(jobId);
    this.artifactPaths.delete(jobId);
    this.listeners.delete(jobId);
  }

  subscribe(jobId: string, listener: JobListener): () => void {
    if (!this.jobs.has(jobId)) throw notFound('job');
    const listeners = this.listeners.get(jobId) ?? new Set<JobListener>();
    listeners.add(listener);
    this.listeners.set(jobId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(jobId);
    };
  }

  async cleanupExpired(now = Date.now()): Promise<number> {
    const expired = [...this.jobs.values()].filter(
      (job) => Date.parse(job.expiresAt) <= now,
    );
    for (const job of expired) {
      this.expiryHandler?.(job.id);
      if (!TERMINAL_STATUSES.has(job.status)) {
        job.status = 'expired';
        job.updatedAt = new Date(now).toISOString();
        job.error = {
          code: 'JOB_EXPIRED',
          message: 'Job artifacts expired',
          retryable: false,
        };
        this.emit(job);
      }
      await rm(this.directory(job.id), { recursive: true, force: true });
      this.jobs.delete(job.id);
      this.artifactPaths.delete(job.id);
      this.listeners.delete(job.id);
    }
    return expired.length;
  }

  private emit(job: OperationJob): void {
    for (const listener of this.listeners.get(job.id) ?? []) {
      listener(cloneJob(job));
    }
  }
}
