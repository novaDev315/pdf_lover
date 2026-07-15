/**
 * Tests for PDF merge functionality
 */

import { describe, it, expect, vi } from 'vitest';
import { mergePDFs, quickMerge } from '../merge.js';

// Mock pdf-lib module
vi.mock('pdf-lib', () => {
  const mockPage = {
    getSize: vi.fn(() => ({ width: 612, height: 792 })),
  };

  const mockPDFDocument = {
    create: vi.fn().mockResolvedValue({
      getPageCount: vi.fn(() => 0),
      copyPages: vi.fn().mockResolvedValue([mockPage]),
      addPage: vi.fn(),
      setProducer: vi.fn(),
      setModificationDate: vi.fn(),
      setTitle: vi.fn(),
      setAuthor: vi.fn(),
      setSubject: vi.fn(),
      setKeywords: vi.fn(),
      setCreator: vi.fn(),
      setCreationDate: vi.fn(),
      save: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])),
    }),
    load: vi.fn().mockImplementation(async () => ({
      getPageCount: vi.fn(() => 2),
      copyPages: vi.fn().mockResolvedValue([mockPage, mockPage]),
    })),
  };

  return {
    PDFDocument: mockPDFDocument,
  };
});

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 2,
      getOutline: vi.fn().mockResolvedValue(null),
      getDestination: vi.fn(),
      getPageIndex: vi.fn(),
      destroy: vi.fn().mockResolvedValue(undefined),
    }),
  })),
}));

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

describe('mergePDFs', () => {
  describe('validation', () => {
    it('should return error when no documents are provided', async () => {
      const result = await mergePDFs({ documents: [] });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PDF');
      expect(result.error).toContain('No documents provided');
    });

    it('should return error when documents array is undefined', async () => {
      const result = await mergePDFs({ documents: undefined as any });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PDF');
    });

    it('should return original document when only one document is provided', async () => {
      const pdfBuffer = createValidPdfBuffer(100);
      const result = await mergePDFs({ documents: [pdfBuffer] });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error when document has invalid magic bytes', async () => {
      const invalidBuffer = new ArrayBuffer(100);
      const result = await mergePDFs({ documents: [invalidBuffer] });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_PDF');
    });

    it('should return error when more than max documents are provided', async () => {
      const documents = Array(51)
        .fill(null)
        .map(() => createValidPdfBuffer(100));

      const result = await mergePDFs({ documents });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('FILE_TOO_LARGE');
      expect(result.error).toContain('Cannot merge more than');
    });
  });

  describe('progress reporting', () => {
    it('should call onProgress callback during merge', async () => {
      const onProgress = vi.fn();
      const documents = [createValidPdfBuffer(100), createValidPdfBuffer(100)];

      await mergePDFs({ documents, onProgress });

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
      const documents = [createValidPdfBuffer(100), createValidPdfBuffer(100)];

      await mergePDFs({ documents, onProgress });

      // Should have called progress for multiple stages
      expect(progressCalls.length).toBeGreaterThan(0);

      // Check that stages include expected names
      const stages = progressCalls.map((p) => p.stage);
      expect(stages.some((s) => s.toLowerCase().includes('validat'))).toBe(true);
    });
  });

  describe('successful merge', () => {
    it('should merge two PDFs successfully', async () => {
      const documents = [createValidPdfBuffer(100), createValidPdfBuffer(100)];

      const result = await mergePDFs({ documents });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.processedSize).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should merge multiple PDFs successfully', async () => {
      const documents = [
        createValidPdfBuffer(100),
        createValidPdfBuffer(100),
        createValidPdfBuffer(100),
      ];

      const result = await mergePDFs({ documents });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle preserveBookmarks when sources have no outlines', async () => {
      const documents = [createValidPdfBuffer(100), createValidPdfBuffer(100)];

      const result = await mergePDFs({
        documents,
        preserveBookmarks: true,
      });

      expect(result.success).toBe(true);
    });

    it('should apply custom metadata when provided', async () => {
      const documents = [createValidPdfBuffer(100), createValidPdfBuffer(100)];

      const result = await mergePDFs({
        documents,
        metadata: {
          title: 'Merged Document',
          author: 'Test Author',
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('duration tracking', () => {
    it('should return duration in result', async () => {
      const documents = [createValidPdfBuffer(100), createValidPdfBuffer(100)];

      const result = await mergePDFs({ documents });

      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('quickMerge', () => {
  it('should return merged ArrayBuffer on success', async () => {
    const buffers = [createValidPdfBuffer(100), createValidPdfBuffer(100)];

    const result = await quickMerge(buffers);

    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it('should return null on failure', async () => {
    const invalidBuffer = new ArrayBuffer(10);
    const result = await quickMerge([invalidBuffer]);

    expect(result).toBeNull();
  });

  it('should return null for empty array', async () => {
    const result = await quickMerge([]);

    expect(result).toBeNull();
  });
});
