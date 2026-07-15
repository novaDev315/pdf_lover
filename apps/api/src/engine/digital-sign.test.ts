import { describe, expect, it } from 'vitest';
import { parseDigitalSignOptions } from './digital-sign.js';

describe('digital signing option validation', () => {
  it('accepts bounded certificate signing metadata', () => {
    expect(parseDigitalSignOptions({ certificatePassword: '', signerName: 'Nova' })).toEqual({
      certificatePassword: '',
      fieldName: 'PDFLoverSignature',
      signerName: 'Nova',
      reason: undefined,
      location: undefined,
    });
  });

  it('rejects unsafe field names and oversized metadata', () => {
    expect(() => parseDigitalSignOptions({ certificatePassword: '', fieldName: '../Sig' })).toThrowError(/fieldName/);
    expect(() => parseDigitalSignOptions({ certificatePassword: '', reason: 'x'.repeat(501) })).toThrowError(/reason/);
  });
});
