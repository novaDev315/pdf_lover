/**
 * PDF utility functions for @pdflover/pdf-core
 */

import { PDFDocument } from 'pdf-lib';
import type {
  PDFDocument as PDFDocumentType,
  PDFPage,
  PDFMetadata,
  ProcessingResult,
  ProcessingErrorCode,
  ProgressCallback,
} from '@pdflover/shared';
import { PDF_MAX_SIZE, ERROR_MESSAGES } from '@pdflover/shared';

/**
 * Load a PDF document from various input types
 * @param input - ArrayBuffer, Uint8Array, or PDFDocument
 * @returns pdf-lib PDFDocument instance
 */
export async function loadPDFDocument(
  input: ArrayBuffer | Uint8Array | PDFDocumentType
): Promise<PDFDocument> {
  if ('data' in input && input.data) {
    // It's a PDFDocumentType with data
    return PDFDocument.load(input.data, { ignoreEncryption: true });
  }
  // It's raw data (ArrayBuffer or Uint8Array)
  return PDFDocument.load(input, { ignoreEncryption: true });
}

/**
 * Get the raw bytes from a PDFDocument or ArrayBuffer
 * @param input - PDF input
 * @returns Uint8Array of PDF bytes
 */
export function getPDFBytes(input: ArrayBuffer | Uint8Array | PDFDocumentType): Uint8Array {
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  if ('data' in input && input.data) {
    return new Uint8Array(input.data);
  }
  throw new Error('Invalid PDF input');
}

/**
 * Validate a PDF buffer
 * @param buffer - Buffer to validate
 * @returns Validation result with error code if invalid
 */
export function validatePDFBuffer(
  buffer: ArrayBuffer | Uint8Array
): { valid: boolean; errorCode?: ProcessingErrorCode; errorMessage?: string } {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

  // Check size
  if (bytes.byteLength > PDF_MAX_SIZE) {
    return {
      valid: false,
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: ERROR_MESSAGES.FILE_TOO_LARGE,
    };
  }

  // Check magic bytes
  if (bytes.byteLength < 5) {
    return {
      valid: false,
      errorCode: 'INVALID_PDF',
      errorMessage: ERROR_MESSAGES.INVALID_PDF,
    };
  }

  // PDF magic bytes: %PDF-
  if (
    bytes[0] !== 0x25 || // %
    bytes[1] !== 0x50 || // P
    bytes[2] !== 0x44 || // D
    bytes[3] !== 0x46 || // F
    bytes[4] !== 0x2d // -
  ) {
    return {
      valid: false,
      errorCode: 'INVALID_PDF',
      errorMessage: ERROR_MESSAGES.INVALID_PDF,
    };
  }

  return { valid: true };
}

/**
 * Extract metadata from a pdf-lib PDFDocument
 * @param doc - pdf-lib PDFDocument
 * @returns PDFMetadata object
 */
export function extractMetadata(doc: PDFDocument): PDFMetadata {
  return {
    title: doc.getTitle() ?? undefined,
    author: doc.getAuthor() ?? undefined,
    subject: doc.getSubject() ?? undefined,
    keywords: doc.getKeywords()?.split(',').map((k) => k.trim()) ?? undefined,
    creator: doc.getCreator() ?? undefined,
    producer: doc.getProducer() ?? undefined,
    creationDate: doc.getCreationDate() ?? undefined,
    modificationDate: doc.getModificationDate() ?? undefined,
  };
}

/**
 * Set metadata on a pdf-lib PDFDocument
 * @param doc - pdf-lib PDFDocument
 * @param metadata - Metadata to set
 */
export function setMetadata(doc: PDFDocument, metadata: Partial<PDFMetadata>): void {
  if (metadata.title !== undefined) doc.setTitle(metadata.title);
  if (metadata.author !== undefined) doc.setAuthor(metadata.author);
  if (metadata.subject !== undefined) doc.setSubject(metadata.subject);
  if (metadata.keywords !== undefined) doc.setKeywords(metadata.keywords);
  if (metadata.creator !== undefined) doc.setCreator(metadata.creator);
  if (metadata.producer !== undefined) doc.setProducer(metadata.producer);
  if (metadata.creationDate !== undefined) doc.setCreationDate(metadata.creationDate);
  if (metadata.modificationDate !== undefined) doc.setModificationDate(metadata.modificationDate);
}

/**
 * Get page information from a pdf-lib page
 * @param page - pdf-lib page
 * @param pageNumber - 1-indexed page number
 * @returns PDFPage object
 */
export function getPageInfo(
  page: ReturnType<PDFDocument['getPage']>,
  pageNumber: number
): PDFPage {
  const { width, height } = page.getSize();
  const rotation = page.getRotation().angle as 0 | 90 | 180 | 270;

  return {
    pageNumber,
    width,
    height,
    rotation,
  };
}

/**
 * Create a failed ProcessingResult
 * @param errorCode - Error code
 * @param errorMessage - Error message
 * @param duration - Processing duration in ms
 * @returns ProcessingResult indicating failure
 */
export function createErrorResult(
  errorCode: ProcessingErrorCode,
  errorMessage: string,
  duration: number
): ProcessingResult {
  return {
    success: false,
    error: errorMessage,
    errorCode,
    duration,
  };
}

/**
 * Create a successful ProcessingResult
 * @param data - Result data
 * @param originalSize - Original file size
 * @param processedSize - Processed file size
 * @param duration - Processing duration in ms
 * @returns ProcessingResult indicating success
 */
export function createSuccessResult(
  data: ArrayBuffer,
  originalSize: number,
  processedSize: number,
  duration: number
): ProcessingResult {
  return {
    success: true,
    data,
    originalSize,
    processedSize,
    compressionRatio: processedSize < originalSize ? originalSize / processedSize : undefined,
    duration,
  };
}

/**
 * Validate page numbers against document page count
 * @param pages - Array of page numbers (1-indexed)
 * @param pageCount - Total pages in document
 * @returns Validation result
 */
export function validatePageNumbers(
  pages: number[],
  pageCount: number
): { valid: boolean; invalidPages?: number[] } {
  const invalidPages = pages.filter((p) => p < 1 || p > pageCount);
  return {
    valid: invalidPages.length === 0,
    invalidPages: invalidPages.length > 0 ? invalidPages : undefined,
  };
}

/**
 * Create a progress reporter that normalizes progress across stages
 * @param callback - Progress callback
 * @param stages - Array of stage names
 * @returns Function to report progress for a specific stage
 */
export function createProgressReporter(
  callback: ProgressCallback | undefined,
  stages: string[]
): (stageIndex: number, stageProgress: number, currentItem?: number, totalItems?: number) => void {
  const stageWeight = 100 / stages.length;

  return (stageIndex: number, stageProgress: number, currentItem?: number, totalItems?: number) => {
    if (!callback) return;

    const baseProgress = stageIndex * stageWeight;
    const percentage = Math.min(100, Math.round(baseProgress + (stageProgress / 100) * stageWeight));

    callback({
      percentage,
      stage: stages[stageIndex] ?? 'Processing',
      currentItem,
      totalItems,
    });
  };
}

/**
 * Measure execution time of an async function
 * @param fn - Async function to measure
 * @returns Result and duration in milliseconds
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = Math.round(performance.now() - start);
  return { result, duration };
}

/**
 * Normalize page rotation to valid values
 * @param angle - Rotation angle
 * @returns Normalized rotation (0, 90, 180, 270)
 */
export function normalizeRotation(angle: number): 0 | 90 | 180 | 270 {
  const normalized = ((angle % 360) + 360) % 360;
  const rounded = Math.round(normalized / 90) * 90;
  return (rounded % 360) as 0 | 90 | 180 | 270;
}
