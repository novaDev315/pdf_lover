import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ApiCapabilities, EngineCapability } from '@pdflover/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { ApiConfig } from './config.js';

const roots: string[] = [];

function engines(available: boolean): EngineCapability[] {
  return [
    { id: 'qpdf', available, required: true },
    { id: 'python', available, required: false },
    { id: 'pillow', available, required: false },
    { id: 'python-docx', available, required: false },
    { id: 'openpyxl', available, required: false },
    { id: 'python-pptx', available, required: false },
    { id: 'pyhanko', available, required: false },
    { id: 'tesseract', available, required: false },
    { id: 'poppler', available, required: false },
  ];
}

function runtime(available: boolean): ApiCapabilities {
  return {
    serviceVersion: 'test',
    maxUploadBytes: 100_000_000,
    artifactTtlSeconds: 1_800,
    engines: engines(available),
    operations: [
      {
        kind: 'pdf.encrypt',
        engine: 'server',
        available,
        unavailableReason: available ? undefined : 'Missing runtime engines: qpdf',
      },
      {
        kind: 'pdf.secure-redact',
        engine: 'server',
        available,
        unavailableReason: available ? undefined : 'Missing runtime engines: poppler, pillow',
      },
      {
        kind: 'pdf.digital-sign',
        engine: 'server',
        available,
        unavailableReason: available ? undefined : 'Missing runtime engines: pyhanko',
      },
    ],
    ai: { openRouterConfigured: false },
  };
}

async function config(): Promise<ApiConfig> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'pdflover-api-test-'));
  roots.push(tempRoot);
  return {
    environment: 'test',
    host: '127.0.0.1',
    port: 8000,
    corsOrigins: ['http://localhost:5173'],
    tempRoot,
    maxUploadBytes: 100_000_000,
    artifactTtlMs: 1_800_000,
    cleanupIntervalMs: 60_000,
    globalConcurrency: 2,
    clientConcurrency: 1,
    processTimeoutMs: 30_000,
    openRouterTimeoutMs: 30_000,
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('API health and failure contracts', () => {
  it('reports liveness and readiness independently', async () => {
    const app = await buildApp({ config: await config(), capabilities: async () => runtime(true) });

    const live = await app.inject({ method: 'GET', url: '/api/v1/health/live' });
    const ready = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: 'ok' });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: 'ready' });
    await app.close();
  });

  it('returns 503 readiness when a required engine is missing', async () => {
    const app = await buildApp({ config: await config(), capabilities: async () => runtime(false) });
    const response = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'not_ready',
      reason: 'one or more required PDF engines are unavailable',
    });
    await app.close();
  });

  it('never accepts a job when its engine is unavailable', async () => {
    const unavailableApp = await buildApp({
      config: await config(),
      capabilities: async () => runtime(false),
    });
    const unavailable = await unavailableApp.inject({
      method: 'POST',
      url: '/api/v1/jobs?operation=pdf.encrypt',
    });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json().error.code).toBe('ENGINE_UNAVAILABLE');
    await unavailableApp.close();

  });

  it('accepts one multipart PDF and publishes the generated artifact', async () => {
    const boundary = 'pdflover-test-boundary';
    const payload = Buffer.from([
      `--${boundary}\r\nContent-Disposition: form-data; name="options"\r\n\r\n`,
      '{"ownerPassword":"owner-secret"}',
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="input.pdf"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      '%PDF-test-input',
      `\r\n--${boundary}--\r\n`,
    ].join(''));
    const app = await buildApp({
      config: await config(),
      capabilities: async () => runtime(true),
      executeOperation: async (input) => {
        expect(input.operation).toBe('pdf.encrypt');
        expect(input.options).toEqual({ ownerPassword: 'owner-secret' });
        return {
          filename: 'input_encrypted.pdf',
          mediaType: 'application/pdf',
          data: Buffer.from('%PDF-encrypted'),
        };
      },
    });

    const accepted = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs?operation=pdf.encrypt',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    expect(accepted.statusCode).toBe(202);
    const id = accepted.json().id as string;

    let job = accepted.json();
    for (let attempt = 0; attempt < 20 && job.status !== 'succeeded'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      job = (await app.inject({ method: 'GET', url: `/api/v1/jobs/${id}` })).json();
    }
    expect(job.status).toBe('succeeded');
    expect(job.artifacts).toHaveLength(1);

    const artifact = await app.inject({
      method: 'GET',
      url: `/api/v1/jobs/${id}/artifacts/${job.artifacts[0].id}`,
    });
    expect(artifact.statusCode).toBe(200);
    expect(artifact.body).toBe('%PDF-encrypted');
    await app.close();
  });

  it('accepts a PDF and PKCS#12 certificate for digital signing', async () => {
    const boundary = 'pdflover-signing-boundary';
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="options"\r\n\r\n`),
      Buffer.from('{"certificatePassword":"secret","fieldName":"ApprovalSignature"}'),
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="input.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-sign-me`),
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="certificate"; filename="signer.p12"\r\nContent-Type: application/x-pkcs12\r\n\r\n`),
      Buffer.from([0x30, 0x82, 0x00, 0x01, 0x00]),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const app = await buildApp({
      config: await config(),
      capabilities: async () => runtime(true),
      executeOperation: async (input) => {
        expect(input.operation).toBe('pdf.digital-sign');
        expect(input.certificatePath).toBeTypeOf('string');
        expect(input.options).toEqual({ certificatePassword: 'secret', fieldName: 'ApprovalSignature' });
        return {
          filename: 'input_digitally_signed.pdf',
          mediaType: 'application/pdf',
          data: Buffer.from('%PDF-signed'),
        };
      },
    });

    const accepted = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs?operation=pdf.digital-sign',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    expect(accepted.statusCode).toBe(202);
    const id = accepted.json().id as string;
    let job = accepted.json();
    for (let attempt = 0; attempt < 20 && job.status !== 'succeeded'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      job = (await app.inject({ method: 'GET', url: `/api/v1/jobs/${id}` })).json();
    }
    expect(job.status).toBe('succeeded');
    expect(job.artifacts[0].filename).toBe('input_digitally_signed.pdf');
    await app.close();
  });

  it('keeps OpenRouter disabled without a server-side key', async () => {
    const app = await buildApp({ config: await config(), capabilities: async () => runtime(true) });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/chat',
      payload: { model: 'test/model', messages: [{ role: 'user', content: 'hello' }] },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('ENGINE_UNAVAILABLE');
    await app.close();
  });
});
