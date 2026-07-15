import { describe, expect, it } from 'vitest';
import { executeQpdfOperation } from './qpdf.js';

describe('executeQpdfOperation validation', () => {
  it('rejects insecure equal owner and user passwords before running qpdf', async () => {
    await expect(executeQpdfOperation({
      operation: 'pdf.encrypt',
      inputPath: '/tmp/input.pdf',
      inputFilename: 'input.pdf',
      options: { userPassword: 'same', ownerPassword: 'same' },
      timeoutMs: 1_000,
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });
  });

  it('requires an owner password for 256-bit encryption', async () => {
    await expect(executeQpdfOperation({
      operation: 'pdf.encrypt',
      inputPath: '/tmp/input.pdf',
      inputFilename: 'input.pdf',
      options: {},
      timeoutMs: 1_000,
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });
  });
});
