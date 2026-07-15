import { describe, expect, it } from 'vitest';
import { parseDocumentOperationOptions } from './document-ops.js';

describe('document operation option validation', () => {
  it('applies bounded defaults for document operations', () => {
    expect(parseDocumentOperationOptions('pdf.ocr', {})).toEqual({
      dpi: 150,
      quality: 70,
      language: 'eng',
      enhanceScans: false,
    });
    expect(parseDocumentOperationOptions('pdf.compress.lossy', {})).toMatchObject({ dpi: 120 });
  });

  it('rejects unsupported languages and out-of-range raster settings', () => {
    expect(() => parseDocumentOperationOptions('pdf.ocr', { language: '../../eng' })).toThrowError(/supported OCR language/);
    expect(() => parseDocumentOperationOptions('pdf.compress.lossy', { quality: 1 })).toThrowError(/between 30 and 95/);
    expect(() => parseDocumentOperationOptions('pdf.convert.pptx', { dpi: 600 })).toThrowError(/between 72 and 300/);
  });
});
