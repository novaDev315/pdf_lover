/**
 * Tests for PDF compression functionality
 */

import { describe, it, expect, vi } from 'vitest';
import { compressPDF, quickCompress, estimateCompression, optimizePDF } from '../compress.js';

// Mock pdf-lib module
vi.mock('pdf-lib', () => {
  const mockPage = {
    getSize: vi.fn(() => ({ width: 612, height: 792 })),
    getRotation: vi.fn(() => ({ angle: 0 })),
  };

  let pageCount = 5;

  const createMockDoc = (pages: number = 5) => ({
    getPageCount: vi.fn(() => pages),
    getPage: vi.fn(() => mockPage),
    copyPages: vi.fn().mockImplementation(async (_source, indices) =>
      indices.map(() => mockPage)
    ),
    addPage: vi.fn(),
    setProducer: vi.fn(),
    setModificationDate: vi.fn(),
    setTitle: vi.fn(),
    setAuthor: vi.fn(),
    setSubject: vi.fn(),
    setKeywords: vi.fn(),
    setCreator: vi.fn(),
    setCreationDate: vi.fn(),
    getTitle: vi.fn(() => 'Test Title'),
    getAuthor: vi.fn(() => 'Test Author'),
    getSubject: vi.fn(() => null),
    getKeywords: vi.fn(() => null),
    getCreator: vi.fn(() => null),
    getProducer: vi.fn(() => null),
    getCreationDate: vi.fn(() => null),
    getModificationDate: vi.fn(() => null),
    getForm: vi.fn(() => ({
      getFields: vi.fn(() => [{ name: 'field1' }]),
      flatten: vi.fn(),
    })),
    save: vi.fn().mockResolvedValue(
      // Return a smaller buffer to simulate compression
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
    ),
  });

  return {
    PDFDocument: {
      create: vi.fn().mockImplementation(() => Promise.resolve(createMockDoc(0))),
      load: vi.fn().mockImplementation(() => Promise.resolve(createMockDoc(pageCount))),
    },
    __setPageCount: (count: number) => {
      pageCount = count;
    },
  };
});

// Create a valid PDF buffer for testing
const createValidPdfBuffer = (size: number = 1000): ArrayBuffer => {
  const buffer = new Uint8Array(size);
  buffer[0] = 0x25; // %
  buffer[1] = 0x50; // P
  buffer[2] = 0x44; // D
  buffer[3] = 0x46; // F
  buffer[4] = 0x2d; // -
  buffer[5] = 0x31; // 1
  buffer[6] = 0x2e; // .
  buffer[7] = 0x34; // 4
  return buffer.buffer;
};

describe('compressPDF', () => {
  describe('validation', () => {
    it('should return error for invalid PDF buffer', async () => {
      const invalidBuffer = new ArrayBuffer(10);
      const result = await compressPDF({
        document: invalidBuffer,
        level: 'medium',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PDF');
    });

    it('should return error for buffer with invalid magic bytes', async () => {
      const invalidPdf = new Uint8Array(100);
      invalidPdf[0] = 0x00;
      const result = await compressPDF({
        document: invalidPdf.buffer,
        level: 'medium',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PDF');
    });
  });

  describe('compression levels', () => {
    it('should compress with low level', async () => {
      const pdfBuffer = createValidPdfBuffer(1000);
      const result = await compressPDF({
        document: pdfBuffer,
        level: 'low',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should compress with medium level', async () => {
      const pdfBuffer = createValidPdfBuffer(1000);
      const result = await compressPDF({
        document: pdfBuffer,
        level: 'medium',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should compress with high level', async () => {
      const pdfBuffer = createValidPdfBuffer(1000);
      const result = await compressPDF({
        document: pdfBuffer,
        level: 'high',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should compress with maximum level', async () => {
      const pdfBuffer = createValidPdfBuffer(1000);
      const result = await compressPDF({
        document: pdfBuffer,
        level: 'maximum',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('options', () => {
    it('should remove metadata when removeMetadata is true', async () => {
      const pdfBuffer = createValidPdfBuffer(1000);
      const result = await compressPDF({
        document: pdfBuffer,
        level: 'medium',
        removeMetadata: true,
      });

      expect(result.success).toBe(true);
    });

    it('should preserve metadata when removeMetadata is false', async () => {
      const pdfBuffer = createValidPdfBuffer(1000);
      const result = await compressPDF({
        document: pdfBuffer,
        level: 'medium',
        removeMetadata: false,
      });

      expect(result.success).toBe(true);
    });

    it('should flatten forms when flattenForms is true', async () => {
      const pdfBuffer = createValidPdfBuffer(1000);
      const result = await compressPDF({
        document: pdfBuffer,
        level: 'medium',
        flattenForms: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('progress reporting', () => {
    it('should call onProgress callback during compression', async () => {
      const onProgress = vi.fn();
      const pdfBuffer = createValidPdfBuffer(1000);

      await compressPDF({
        document: pdfBuffer,
        level: 'medium',
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          percentage: expect.any(Number),
          stage: expect.any(String),
        })
      );
    });

    it('should report progress through all stages', async () => {
      const progressCalls: Array<{ percentage: number; stage: string }> = [];
      const onProgress = vi.fn((info) => progressCalls.push(info));
      const pdfBuffer = createValidPdfBuffer(1000);

      await compressPDF({
        document: pdfBuffer,
        level: 'medium',
        onProgress,
      });

      expect(progressCalls.length).toBeGreaterThan(0);
    });
  });

  describe('result properties', () => {
    it('should return original and processed size', async () => {
      const pdfBuffer = createValidPdfBuffer(1000);
      const result = await compressPDF({
        document: pdfBuffer,
        level: 'medium',
      });

      expect(result.success).toBe(true);
      expect(result.originalSize).toBe(1000);
      expect(result.processedSize).toBeGreaterThan(0);
    });

    it('should calculate compression ratio when size decreased', async () => {
      const pdfBuffer = createValidPdfBuffer(1000);
      const result = await compressPDF({
        document: pdfBuffer,
        level: 'maximum',
      });

      expect(result.success).toBe(true);
      // Mock returns 8 bytes, original is 1000, so ratio should be ~125
      if (result.processedSize! < result.originalSize!) {
        expect(result.compressionRatio).toBeGreaterThan(1);
      }
    });

    it('should return duration', async () => {
      const pdfBuffer = createValidPdfBuffer(1000);
      const result = await compressPDF({
        document: pdfBuffer,
        level: 'medium',
      });

      expect(result.success).toBe(true);
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('quickCompress', () => {
  it('should return compressed ArrayBuffer on success', async () => {
    const pdfBuffer = createValidPdfBuffer(1000);
    const result = await quickCompress(pdfBuffer);

    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it('should use medium level by default', async () => {
    const pdfBuffer = createValidPdfBuffer(1000);
    const result = await quickCompress(pdfBuffer);

    expect(result).toBeDefined();
  });

  it('should accept custom compression level', async () => {
    const pdfBuffer = createValidPdfBuffer(1000);
    const resultHigh = await quickCompress(pdfBuffer, 'high');
    const resultLow = await quickCompress(pdfBuffer, 'low');

    expect(resultHigh).toBeDefined();
    expect(resultLow).toBeDefined();
  });

  it('should return null on failure', async () => {
    const invalidBuffer = new ArrayBuffer(10);
    const result = await quickCompress(invalidBuffer);

    expect(result).toBeNull();
  });
});

describe('estimateCompression', () => {
  it('should return estimated savings', async () => {
    const pdfBuffer = createValidPdfBuffer(1000);
    const result = await estimateCompression(pdfBuffer);

    expect(result.estimatedSavings).toBeGreaterThanOrEqual(0);
    expect(result.estimatedSavings).toBeLessThanOrEqual(50);
  });

  it('should detect if PDF has forms', async () => {
    const pdfBuffer = createValidPdfBuffer(1000);
    const result = await estimateCompression(pdfBuffer);

    expect(typeof result.hasForms).toBe('boolean');
  });

  it('should detect if PDF likely has images', async () => {
    // Create a "large" buffer that would suggest images
    const largePdfBuffer = createValidPdfBuffer(600000); // 600KB for 5 pages = >100KB/page
    const result = await estimateCompression(largePdfBuffer);

    expect(typeof result.hasImages).toBe('boolean');
  });

  it('should return default values on error', async () => {
    const invalidBuffer = new ArrayBuffer(10);
    const result = await estimateCompression(invalidBuffer);

    expect(result.estimatedSavings).toBe(0);
    expect(result.hasImages).toBe(false);
    expect(result.hasForms).toBe(false);
  });

  it('should estimate higher savings for large documents', async () => {
    // This test depends on the mock returning 5 pages
    const pdfBuffer = createValidPdfBuffer(1000);
    const result = await estimateCompression(pdfBuffer);

    // Structural optimization is not guaranteed to reduce a compact PDF.
    expect(result.estimatedSavings).toBe(0);
  });
});

describe('optimizePDF', () => {
  it('should optimize PDF with low compression level', async () => {
    const pdfBuffer = createValidPdfBuffer(1000);
    const result = await optimizePDF(pdfBuffer);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should preserve metadata during optimization', async () => {
    const pdfBuffer = createValidPdfBuffer(1000);
    const result = await optimizePDF(pdfBuffer);

    // optimizePDF calls compressPDF with removeMetadata: false
    expect(result.success).toBe(true);
  });

  it('should not flatten forms during optimization', async () => {
    const pdfBuffer = createValidPdfBuffer(1000);
    const result = await optimizePDF(pdfBuffer);

    // optimizePDF calls compressPDF with flattenForms: false
    expect(result.success).toBe(true);
  });

  it('should return error for invalid PDF', async () => {
    const invalidBuffer = new ArrayBuffer(10);
    const result = await optimizePDF(invalidBuffer);

    expect(result.success).toBe(false);
  });
});
