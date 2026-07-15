import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { JobStore } from './job-store.js';

const roots: string[] = [];

async function createStore(ttlMs = 60_000): Promise<JobStore> {
  const root = await mkdtemp(join(tmpdir(), 'pdflover-job-test-'));
  roots.push(root);
  const store = new JobStore({ root, ttlMs, cleanupIntervalMs: 60_000 });
  await store.initialize();
  return store;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('JobStore', () => {
  it('stores validated artifacts beneath the job root', async () => {
    const store = await createStore();
    const job = await store.create('pdf.encrypt');
    const artifact = await store.storeArtifact(job.id, {
      filename: '../../protected document.pdf',
      mediaType: 'application/pdf',
      data: new TextEncoder().encode('%PDF-safe'),
    });

    expect(artifact.filename).toBe('protected_document.pdf');
    expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    const loaded = await store.readArtifact(job.id, artifact.id);
    expect(loaded.data.toString()).toBe('%PDF-safe');
    await expect(access(join(store.root, '..', 'protected document.pdf'))).rejects.toThrow();
    store.close();
  });

  it('cancels active jobs and removes their artifacts', async () => {
    const store = await createStore();
    const job = await store.create('pdf.ocr');
    const artifact = await store.storeArtifact(job.id, {
      filename: 'ocr.pdf',
      mediaType: 'application/pdf',
      data: new TextEncoder().encode('%PDF-result'),
    });

    const cancelled = await store.cancel(job.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.error?.code).toBe('JOB_CANCELLED');
    await expect(store.readArtifact(job.id, artifact.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    store.close();
  });

  it('removes uploaded input bytes after processing without touching artifacts', async () => {
    const store = await createStore();
    const job = await store.create('pdf.encrypt');
    const input = await store.storeInput(job.id, {
      filename: 'private.pdf',
      stream: Readable.from(Buffer.from('%PDF-private')),
      maxBytes: 1_024,
    });
    const artifact = await store.storeArtifact(job.id, {
      filename: 'protected.pdf',
      mediaType: 'application/pdf',
      data: new TextEncoder().encode('%PDF-protected'),
    });

    await store.deleteInput(job.id, input.path);

    await expect(access(input.path)).rejects.toThrow();
    expect((await store.readArtifact(job.id, artifact.id)).data.toString()).toBe('%PDF-protected');
    store.close();
  });

  it('stores a bounded DER-encoded PKCS#12 certificate in the job directory', async () => {
    const store = await createStore();
    const job = await store.create('pdf.digital-sign');
    const certificate = await store.storeCertificate(job.id, {
      filename: '../../signer.p12',
      stream: Readable.from(Buffer.from([0x30, 0x82, 0x00, 0x01, 0x00])),
    });

    expect(certificate.filename).toBe('signer.p12');
    expect(certificate.path.startsWith(store.root)).toBe(true);
    await store.deleteInput(job.id, certificate.path);
    await expect(access(certificate.path)).rejects.toThrow();
    store.close();
  });

  it('expires jobs and removes their temporary directories', async () => {
    const store = await createStore(10);
    const job = await store.create('pdf.decrypt');
    const expired: string[] = [];
    store.setExpiryHandler((jobId) => expired.push(jobId));
    const count = await store.cleanupExpired(Date.parse(job.expiresAt) + 1);

    expect(count).toBe(1);
    expect(expired).toEqual([job.id]);
    expect(() => store.get(job.id)).toThrowError(/Job not found/);
    store.close();
  });
});
