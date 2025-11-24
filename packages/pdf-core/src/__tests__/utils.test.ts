/**
 * Tests for PDF utility functions
 */

import { describe, it, expect, vi } from 'vitest';
import {
  getPDFBytes,
  validatePDFBuffer,
  validatePageNumbers,
  createProgressReporter,
  measureTime,
  normalizeRotation,
  createErrorResult,
  createSuccessResult,
  loadPDFDocument,
  extractMetadata,
  setMetadata,
  getPageInfo,
} from '../utils.js';
import { PDFDocument } from 'pdf-lib';

// PDF magic bytes: %PDF-
const createValidPdfBuffer = (size: number = 100): Uint8Array => {
  const buffer = new Uint8Array(size);
  buffer[0] = 0x25; // %
  buffer[1] = 0x50; // P
  buffer[2] = 0x44; // D
  buffer[3] = 0x46; // F
  buffer[4] = 0x2d; // -
  return buffer;
};

const createInvalidPdfBuffer = (size: number = 100): Uint8Array => {
  const buffer = new Uint8Array(size);
  buffer[0] = 0x00;
  buffer[1] = 0x00;
  buffer[2] = 0x00;
  buffer[3] = 0x00;
  buffer[4] = 0x00;
  return buffer;
};

describe('getPDFBytes', () => {
  it('should convert ArrayBuffer to Uint8Array', () => {
    const arrayBuffer = new ArrayBuffer(10);
    const result = getPDFBytes(arrayBuffer);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.byteLength).toBe(10);
  });

  it('should return Uint8Array as-is', () => {
    const uint8Array = new Uint8Array(10);
    const result = getPDFBytes(uint8Array);
    expect(result).toBe(uint8Array);
  });

  it('should handle PDFDocument type with data property', () => {
    const mockPdfDoc = {
      data: new ArrayBuffer(10),
    };
    const result = getPDFBytes(mockPdfDoc as any);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should throw error for invalid input', () => {
    expect(() => getPDFBytes({} as any)).toThrow('Invalid PDF input');
  });
});

describe('validatePDFBuffer', () => {
  it('should validate a valid PDF buffer', () => {
    const validPdf = createValidPdfBuffer();
    const result = validatePDFBuffer(validPdf);
    expect(result.valid).toBe(true);
    expect(result.errorCode).toBeUndefined();
    expect(result.errorMessage).toBeUndefined();
  });

  it('should reject buffer that is too small', () => {
    const smallBuffer = new Uint8Array(4);
    const result = validatePDFBuffer(smallBuffer);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INVALID_PDF');
  });

  it('should reject buffer with invalid magic bytes', () => {
    const invalidPdf = createInvalidPdfBuffer();
    const result = validatePDFBuffer(invalidPdf);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INVALID_PDF');
  });

  it('should reject buffer that is too large', () => {
    // Create a buffer larger than 100MB (PDF_MAX_SIZE)
    // We mock this by using a smaller size for testing
    const largeBuffer = createValidPdfBuffer(101 * 1024 * 1024);
    const result = validatePDFBuffer(largeBuffer);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('FILE_TOO_LARGE');
  });

  it('should work with ArrayBuffer input', () => {
    const validPdf = createValidPdfBuffer();
    const arrayBuffer = validPdf.buffer.slice(0, validPdf.byteLength) as ArrayBuffer;
    const result = validatePDFBuffer(arrayBuffer);
    expect(result.valid).toBe(true);
  });
});

describe('validatePageNumbers', () => {
  it('should validate valid page numbers', () => {
    const result = validatePageNumbers([1, 2, 3], 5);
    expect(result.valid).toBe(true);
    expect(result.invalidPages).toBeUndefined();
  });

  it('should detect page numbers below 1', () => {
    const result = validatePageNumbers([0, 1, 2], 5);
    expect(result.valid).toBe(false);
    expect(result.invalidPages).toContain(0);
  });

  it('should detect page numbers above page count', () => {
    const result = validatePageNumbers([1, 2, 10], 5);
    expect(result.valid).toBe(false);
    expect(result.invalidPages).toContain(10);
  });

  it('should handle empty page array', () => {
    const result = validatePageNumbers([], 5);
    expect(result.valid).toBe(true);
    expect(result.invalidPages).toBeUndefined();
  });

  it('should detect multiple invalid pages', () => {
    const result = validatePageNumbers([0, 5, 10, 20], 5);
    expect(result.valid).toBe(false);
    expect(result.invalidPages).toEqual([0, 10, 20]);
  });
});

describe('createProgressReporter', () => {
  it('should call callback with normalized progress', () => {
    const callback = vi.fn();
    const stages = ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4'];
    const reporter = createProgressReporter(callback, stages);

    reporter(0, 50);
    expect(callback).toHaveBeenCalledWith({
      percentage: 13, // (0 * 25) + (50/100 * 25) = 12.5, rounded to 13
      stage: 'Stage 1',
      currentItem: undefined,
      totalItems: undefined,
    });
  });

  it('should report correct stage name', () => {
    const callback = vi.fn();
    const stages = ['Loading', 'Processing', 'Saving'];
    const reporter = createProgressReporter(callback, stages);

    reporter(1, 0);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'Processing' })
    );
  });

  it('should include item counts when provided', () => {
    const callback = vi.fn();
    const stages = ['Stage 1'];
    const reporter = createProgressReporter(callback, stages);

    reporter(0, 50, 5, 10);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        currentItem: 5,
        totalItems: 10,
      })
    );
  });

  it('should handle undefined callback gracefully', () => {
    const reporter = createProgressReporter(undefined, ['Stage 1']);
    expect(() => reporter(0, 50)).not.toThrow();
  });

  it('should cap progress at 100', () => {
    const callback = vi.fn();
    const stages = ['Stage 1'];
    const reporter = createProgressReporter(callback, stages);

    reporter(0, 200);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ percentage: 100 })
    );
  });
});

describe('measureTime', () => {
  it('should return result and duration', async () => {
    const testFn = async () => 'test result';
    const { result, duration } = await measureTime(testFn);

    expect(result).toBe('test result');
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('should measure actual execution time', async () => {
    const delay = 50;
    const testFn = async () => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return 'done';
    };

    const { result, duration } = await measureTime(testFn);

    expect(result).toBe('done');
    expect(duration).toBeGreaterThanOrEqual(delay - 10); // Allow some tolerance
  });

  it('should handle async errors', async () => {
    const testFn = async () => {
      throw new Error('Test error');
    };

    await expect(measureTime(testFn)).rejects.toThrow('Test error');
  });
});

describe('normalizeRotation', () => {
  it('should return 0 for 0 degrees', () => {
    expect(normalizeRotation(0)).toBe(0);
  });

  it('should return 90 for 90 degrees', () => {
    expect(normalizeRotation(90)).toBe(90);
  });

  it('should return 180 for 180 degrees', () => {
    expect(normalizeRotation(180)).toBe(180);
  });

  it('should return 270 for 270 degrees', () => {
    expect(normalizeRotation(270)).toBe(270);
  });

  it('should normalize 360 to 0', () => {
    expect(normalizeRotation(360)).toBe(0);
  });

  it('should normalize angles greater than 360', () => {
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(720)).toBe(0);
  });

  it('should normalize negative angles', () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(-180)).toBe(180);
    expect(normalizeRotation(-270)).toBe(90);
  });

  it('should round to nearest 90 degrees', () => {
    // 45/90 = 0.5 rounds to 1 -> 90
    expect(normalizeRotation(45)).toBe(90);
    // 44/90 = 0.48 rounds to 0 -> 0
    expect(normalizeRotation(44)).toBe(0);
    // 135/90 = 1.5 rounds to 2 -> 180
    expect(normalizeRotation(135)).toBe(180);
  });
});

describe('createErrorResult', () => {
  it('should create a proper error result', () => {
    const result = createErrorResult('INVALID_PDF', 'Test error message', 100);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Test error message');
    expect(result.errorCode).toBe('INVALID_PDF');
    expect(result.duration).toBe(100);
  });

  it('should have no data field', () => {
    const result = createErrorResult('CORRUPTED_PDF', 'Corrupted', 50);
    expect(result.data).toBeUndefined();
  });
});

describe('createSuccessResult', () => {
  it('should create a proper success result', () => {
    const data = new ArrayBuffer(100);
    const result = createSuccessResult(data, 200, 100, 50);

    expect(result.success).toBe(true);
    expect(result.data).toBe(data);
    expect(result.originalSize).toBe(200);
    expect(result.processedSize).toBe(100);
    expect(result.duration).toBe(50);
  });

  it('should calculate compression ratio when size decreased', () => {
    const data = new ArrayBuffer(50);
    const result = createSuccessResult(data, 100, 50, 0);

    expect(result.compressionRatio).toBe(2); // 100/50 = 2
  });

  it('should not have compression ratio when size increased', () => {
    const data = new ArrayBuffer(150);
    const result = createSuccessResult(data, 100, 150, 0);

    expect(result.compressionRatio).toBeUndefined();
  });

  it('should not have compression ratio when size is equal', () => {
    const data = new ArrayBuffer(100);
    const result = createSuccessResult(data, 100, 100, 0);

    expect(result.compressionRatio).toBeUndefined();
  });
});

describe('loadPDFDocument', () => {
  it('should load PDF from ArrayBuffer', async () => {
    // Create a real minimal PDF for this test
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBytes = await pdfDoc.save();

    const loaded = await loadPDFDocument(pdfBytes.buffer as ArrayBuffer);

    expect(loaded).toBeDefined();
    expect(loaded.getPageCount()).toBe(1);
  });

  it('should load PDF from Uint8Array', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBytes = await pdfDoc.save();

    const loaded = await loadPDFDocument(pdfBytes);

    expect(loaded).toBeDefined();
    expect(loaded.getPageCount()).toBe(1);
  });

  it('should load PDF from PDFDocumentType with data property', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    const pdfBytes = await pdfDoc.save();

    const mockPdfDocType = {
      data: pdfBytes.buffer,
    };

    const loaded = await loadPDFDocument(mockPdfDocType as any);

    expect(loaded).toBeDefined();
    expect(loaded.getPageCount()).toBe(1);
  });

  it('should throw error for invalid PDF data', async () => {
    const invalidData = new ArrayBuffer(10);

    await expect(loadPDFDocument(invalidData)).rejects.toThrow();
  });
});

describe('extractMetadata', () => {
  it('should extract all available metadata', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle('Test Title');
    pdfDoc.setAuthor('Test Author');
    pdfDoc.setSubject('Test Subject');
    pdfDoc.setKeywords(['key1', 'key2']);
    pdfDoc.setCreator('Test Creator');
    pdfDoc.setProducer('Test Producer');

    const metadata = extractMetadata(pdfDoc);

    expect(metadata.title).toBe('Test Title');
    expect(metadata.author).toBe('Test Author');
    expect(metadata.subject).toBe('Test Subject');
    // pdf-lib stores keywords as array, extractMetadata splits comma-separated string
    expect(metadata.keywords).toBeDefined();
    expect(metadata.creator).toBe('Test Creator');
    expect(metadata.producer).toBe('Test Producer');
  });

  it('should handle missing metadata gracefully', async () => {
    const pdfDoc = await PDFDocument.create();

    const metadata = extractMetadata(pdfDoc);

    expect(metadata.title).toBeUndefined();
    expect(metadata.author).toBeUndefined();
    expect(metadata.subject).toBeUndefined();
    expect(metadata.keywords).toBeUndefined();
  });

  it('should parse comma-separated keywords', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setKeywords(['pdf', 'test', 'keywords']);

    const metadata = extractMetadata(pdfDoc);

    expect(Array.isArray(metadata.keywords)).toBe(true);
  });
});

describe('setMetadata', () => {
  it('should set all metadata fields', async () => {
    const pdfDoc = await PDFDocument.create();

    setMetadata(pdfDoc, {
      title: 'New Title',
      author: 'New Author',
      subject: 'New Subject',
      keywords: ['new', 'keywords'],
      creator: 'New Creator',
      producer: 'New Producer',
    });

    expect(pdfDoc.getTitle()).toBe('New Title');
    expect(pdfDoc.getAuthor()).toBe('New Author');
    expect(pdfDoc.getSubject()).toBe('New Subject');
    // Keywords can be returned as string or array depending on pdf-lib version
    expect(pdfDoc.getKeywords()).toBeDefined();
    expect(pdfDoc.getCreator()).toBe('New Creator');
    expect(pdfDoc.getProducer()).toBe('New Producer');
  });

  it('should only set provided fields', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle('Original Title');

    setMetadata(pdfDoc, {
      author: 'New Author',
    });

    expect(pdfDoc.getTitle()).toBe('Original Title');
    expect(pdfDoc.getAuthor()).toBe('New Author');
  });

  it('should handle date fields', async () => {
    const pdfDoc = await PDFDocument.create();
    const testDate = new Date('2024-01-15T12:00:00Z');

    setMetadata(pdfDoc, {
      creationDate: testDate,
      modificationDate: testDate,
    });

    expect(pdfDoc.getCreationDate()).toEqual(testDate);
    expect(pdfDoc.getModificationDate()).toEqual(testDate);
  });
});

describe('getPageInfo', () => {
  it('should return page dimensions and rotation', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);

    const pageInfo = getPageInfo(page, 1);

    expect(pageInfo.pageNumber).toBe(1);
    expect(pageInfo.width).toBe(612);
    expect(pageInfo.height).toBe(792);
    expect(pageInfo.rotation).toBe(0);
  });

  it('should return correct page number', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([612, 792]);
    pdfDoc.addPage([612, 792]);
    const page = pdfDoc.getPage(1);

    const pageInfo = getPageInfo(page, 2);

    expect(pageInfo.pageNumber).toBe(2);
  });

  it('should handle different page sizes', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([842, 595]); // A4 landscape

    const pageInfo = getPageInfo(page, 1);

    expect(pageInfo.width).toBe(842);
    expect(pageInfo.height).toBe(595);
  });

  it('should capture page rotation', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    page.setRotation({ angle: 90, type: 'degrees' } as any);

    const pageInfo = getPageInfo(page, 1);

    expect(pageInfo.rotation).toBe(90);
  });
});
