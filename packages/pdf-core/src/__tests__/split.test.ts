/**
 * Tests for PDF split functionality
 */

import { describe, it, expect, vi } from 'vitest';
import { splitPDF, extractPages, removePages, splitIntoParts } from '../split.js';

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
    getForm: vi.fn(() => ({
      getFields: vi.fn(() => []),
      flatten: vi.fn(),
    })),
    save: vi.fn().mockResolvedValue(
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
const createValidPdfBuffer = (size: number = 100): ArrayBuffer => {
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

describe('splitPDF', () => {
  describe('validation', () => {
    it('should return error for invalid PDF buffer', async () => {
      const invalidBuffer = new ArrayBuffer(10);
      const result = await splitPDF({
        document: invalidBuffer,
        mode: 'single',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PDF');
    });

    it('should return error when ranges are missing for range mode', async () => {
      const pdfBuffer = createValidPdfBuffer(100);
      const result = await splitPDF({
        document: pdfBuffer,
        mode: 'range',
        ranges: [],
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PAGE_OUT_OF_RANGE');
      expect(result.error).toContain('ranges are required');
    });

    it('should return error for out-of-range page numbers', async () => {
      const pdfBuffer = createValidPdfBuffer(100);
      const result = await splitPDF({
        document: pdfBuffer,
        mode: 'range',
        ranges: [{ start: 1, end: 100 }],
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PAGE_OUT_OF_RANGE');
    });

    it('should return error when start is greater than end', async () => {
      const pdfBuffer = createValidPdfBuffer(100);
      const result = await splitPDF({
        document: pdfBuffer,
        mode: 'range',
        ranges: [{ start: 5, end: 1 }],
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PAGE_OUT_OF_RANGE');
      expect(result.error).toContain('cannot be greater than');
    });
  });

  describe('single page mode', () => {
    it('should split PDF into individual pages', async () => {
      const pdfBuffer = createValidPdfBuffer(100);
      const result = await splitPDF({
        document: pdfBuffer,
        mode: 'single',
        outputPrefix: 'page',
      });

      expect(result.success).toBe(true);
      expect(result.files).toBeDefined();
      expect(result.files!.length).toBe(5); // Mock has 5 pages
    });

    it('should generate correct filenames for single pages', async () => {
      const pdfBuffer = createValidPdfBuffer(100);
      const result = await splitPDF({
        document: pdfBuffer,
        mode: 'single',
        outputPrefix: 'doc',
      });

      expect(result.success).toBe(true);
      expect(result.files![0].filename).toBe('doc_page1.pdf');
      expect(result.files![1].filename).toBe('doc_page2.pdf');
    });
  });

  describe('range mode', () => {
    it('should split PDF by page ranges', async () => {
      const pdfBuffer = createValidPdfBuffer(100);
      const result = await splitPDF({
        document: pdfBuffer,
        mode: 'range',
        ranges: [
          { start: 1, end: 2 },
          { start: 3, end: 5 },
        ],
        outputPrefix: 'split',
      });

      expect(result.success).toBe(true);
      expect(result.files!.length).toBe(2);
    });

    it('should generate correct filenames for ranges', async () => {
      const pdfBuffer = createValidPdfBuffer(100);
      const result = await splitPDF({
        document: pdfBuffer,
        mode: 'range',
        ranges: [{ start: 1, end: 3 }],
        outputPrefix: 'section',
      });

      expect(result.success).toBe(true);
      expect(result.files![0].filename).toBe('section_pages1-3.pdf');
    });
  });

  describe('size mode', () => {
    it('should split PDF in half for size mode', async () => {
      const pdfBuffer = createValidPdfBuffer(100);
      const result = await splitPDF({
        document: pdfBuffer,
        mode: 'size',
        outputPrefix: 'part',
      });

      expect(result.success).toBe(true);
      expect(result.files!.length).toBe(2); // Split in half
    });
  });

  describe('bookmark mode', () => {
    it('should handle bookmark mode (returns whole document)', async () => {
      const pdfBuffer = createValidPdfBuffer(100);
      const result = await splitPDF({
        document: pdfBuffer,
        mode: 'bookmark',
      });

      expect(result.success).toBe(true);
      expect(result.files!.length).toBe(1);
    });
  });

  describe('specific pages mode', () => {
    it('should extract specific pages when pages array is provided', async () => {
      const pdfBuffer = createValidPdfBuffer(100);
      const result = await splitPDF({
        document: pdfBuffer,
        mode: undefined as any, // Default mode
        pages: [1, 3, 5],
        outputPrefix: 'extract',
      });

      expect(result.success).toBe(true);
      expect(result.files!.length).toBe(3);
    });

    it('should return error for invalid pages', async () => {
      const pdfBuffer = createValidPdfBuffer(100);
      const result = await splitPDF({
        document: pdfBuffer,
        mode: undefined as any,
        pages: [0, 10],
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PAGE_OUT_OF_RANGE');
    });
  });

  describe('progress reporting', () => {
    it('should call onProgress callback during split', async () => {
      const onProgress = vi.fn();
      const pdfBuffer = createValidPdfBuffer(100);

      await splitPDF({
        document: pdfBuffer,
        mode: 'single',
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
    });
  });
});

describe('extractPages', () => {
  it('should extract specified pages from PDF', async () => {
    const pdfBuffer = createValidPdfBuffer(100);
    const result = await extractPages(pdfBuffer, [1, 2, 3]);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.files![0].pageCount).toBe(3);
  });

  it('should remove duplicate pages', async () => {
    const pdfBuffer = createValidPdfBuffer(100);
    const result = await extractPages(pdfBuffer, [1, 1, 2, 2, 3]);

    expect(result.success).toBe(true);
    expect(result.files![0].pageCount).toBe(3);
  });

  it('should sort pages', async () => {
    const pdfBuffer = createValidPdfBuffer(100);
    const result = await extractPages(pdfBuffer, [3, 1, 2]);

    expect(result.success).toBe(true);
    // Pages should be extracted in sorted order
  });

  it('should return error for invalid pages', async () => {
    const pdfBuffer = createValidPdfBuffer(100);
    const result = await extractPages(pdfBuffer, [0, 100]);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PAGE_OUT_OF_RANGE');
  });

  it('should use custom output filename', async () => {
    const pdfBuffer = createValidPdfBuffer(100);
    const result = await extractPages(pdfBuffer, [1], 'custom.pdf');

    expect(result.success).toBe(true);
    expect(result.files![0].filename).toBe('custom.pdf');
  });
});

describe('removePages', () => {
  it('should remove specified pages from PDF', async () => {
    const pdfBuffer = createValidPdfBuffer(100);
    const result = await removePages(pdfBuffer, [1, 2]);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should return error when trying to remove all pages', async () => {
    const pdfBuffer = createValidPdfBuffer(100);
    const result = await removePages(pdfBuffer, [1, 2, 3, 4, 5]);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PAGE_OUT_OF_RANGE');
    expect(result.error).toContain('Cannot remove all pages');
  });

  it('should handle invalid PDF buffer', async () => {
    const invalidBuffer = new ArrayBuffer(10);
    const result = await removePages(invalidBuffer, [1]);

    expect(result.success).toBe(false);
  });
});

describe('splitIntoParts', () => {
  it('should split PDF into specified number of parts', async () => {
    const pdfBuffer = createValidPdfBuffer(100);
    const result = await splitIntoParts(pdfBuffer, 2);

    expect(result.success).toBe(true);
    expect(result.files!.length).toBe(2);
  });

  it('should handle uneven division', async () => {
    const pdfBuffer = createValidPdfBuffer(100);
    const result = await splitIntoParts(pdfBuffer, 3);

    expect(result.success).toBe(true);
    // 5 pages / 3 parts = 2, 2, 1 pages
  });

  it('should return error for invalid PDF', async () => {
    const invalidBuffer = new ArrayBuffer(10);
    const result = await splitIntoParts(invalidBuffer, 2);

    expect(result.success).toBe(false);
  });

  it('should handle single part request', async () => {
    const pdfBuffer = createValidPdfBuffer(100);
    const result = await splitIntoParts(pdfBuffer, 1);

    expect(result.success).toBe(true);
    expect(result.files!.length).toBe(1);
  });
});
