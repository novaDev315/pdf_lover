import { describe, expect, it } from 'vitest';
import { executeSecureRedaction } from './secure-redact.js';

describe('executeSecureRedaction validation', () => {
  it('rejects missing redaction rectangles before launching an engine', async () => {
    await expect(executeSecureRedaction({
      inputPath: '/tmp/input.pdf',
      inputFilename: 'input.pdf',
      options: { redactions: [] },
      timeoutMs: 1_000,
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });
  });

  it('rejects negative or zero-sized rectangles', async () => {
    await expect(executeSecureRedaction({
      inputPath: '/tmp/input.pdf',
      inputFilename: 'input.pdf',
      options: { redactions: [{ page: 1, x: 0, y: 0, width: 0, height: 10 }] },
      timeoutMs: 1_000,
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });
  });
});
