/**
 * PDF split functionality for @pdflover/pdf-core
 */

import { PDFDocument } from 'pdf-lib';
import type {
  SplitOptions,
  ProcessingResult,
  PageRange,
  PDFDocument as PDFDocumentType,
} from '@pdflover/shared';
import { ERROR_MESSAGES } from '@pdflover/shared';
import {
  loadPDFDocument,
  validatePDFBuffer,
  validatePageNumbers,
  createErrorResult,
  createProgressReporter,
  measureTime,
  getPDFBytes,
  setMetadata,
} from './utils.js';

/**
 * Result file information for split operations
 */
interface SplitFile {
  filename: string;
  data: ArrayBuffer;
  pageCount: number;
}

/**
 * Split a PDF document into multiple documents
 *
 * @param options - Split options including mode and settings
 * @returns ProcessingResult with array of split files
 *
 * @example
 * ```typescript
 * // Split into single pages
 * const result = await splitPDF({
 *   document: pdfArrayBuffer,
 *   mode: 'single',
 *   outputPrefix: 'page',
 * });
 *
 * // Split by page ranges
 * const result = await splitPDF({
 *   document: pdfArrayBuffer,
 *   mode: 'range',
 *   ranges: [{ start: 1, end: 5 }, { start: 6, end: 10 }],
 * });
 * ```
 */
export async function splitPDF(options: SplitOptions): Promise<ProcessingResult> {
  const {
    document,
    mode,
    ranges,
    pages,
    outputPrefix = 'split',
    onProgress,
  } = options;

  const stages = ['Validating', 'Loading document', 'Splitting pages', 'Saving files'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    const bytes = getPDFBytes(document);
    const validation = validatePDFBuffer(bytes);

    if (!validation.valid) {
      return createErrorResult(validation.errorCode!, validation.errorMessage!, 0);
    }

    reportProgress(0, 100);

    // Stage 1: Load document
    reportProgress(1, 0);

    let sourceDoc: PDFDocument;
    try {
      sourceDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('encrypt')) {
        return createErrorResult('ENCRYPTED_PDF', ERROR_MESSAGES.ENCRYPTED_PDF, 0);
      }
      return createErrorResult('CORRUPTED_PDF', ERROR_MESSAGES.CORRUPTED_PDF, 0);
    }

    const pageCount = sourceDoc.getPageCount();
    reportProgress(1, 100);

    // Stage 2: Determine pages to extract based on mode
    reportProgress(2, 0);

    const splitRanges: PageRange[] = [];

    switch (mode) {
      case 'single':
        // Split into individual pages
        for (let i = 1; i <= pageCount; i++) {
          splitRanges.push({ start: i, end: i });
        }
        break;

      case 'range':
        if (!ranges || ranges.length === 0) {
          return createErrorResult(
            'PAGE_OUT_OF_RANGE',
            'Page ranges are required for range mode',
            0
          );
        }
        // Validate all ranges
        for (const range of ranges) {
          const startValid = validatePageNumbers([range.start], pageCount);
          const endValid = validatePageNumbers([range.end], pageCount);
          if (!startValid.valid || !endValid.valid) {
            return createErrorResult(
              'PAGE_OUT_OF_RANGE',
              `Page range ${range.start}-${range.end} is out of bounds (document has ${pageCount} pages)`,
              0
            );
          }
          if (range.start > range.end) {
            return createErrorResult(
              'PAGE_OUT_OF_RANGE',
              `Invalid range: start (${range.start}) cannot be greater than end (${range.end})`,
              0
            );
          }
          splitRanges.push(range);
        }
        break;

      case 'size':
        // Split by file size - not fully implemented in browser context
        // Would require iterative save and size check
        // For now, fall back to splitting in half
        const midPoint = Math.ceil(pageCount / 2);
        splitRanges.push({ start: 1, end: midPoint });
        if (midPoint < pageCount) {
          splitRanges.push({ start: midPoint + 1, end: pageCount });
        }
        break;

      case 'bookmark':
        // Split by bookmarks - requires outline parsing
        // pdf-lib has limited bookmark support
        // For now, treat as single split (whole document)
        splitRanges.push({ start: 1, end: pageCount });
        break;

      default:
        // Handle specific pages if provided
        if (pages && pages.length > 0) {
          const pageValidation = validatePageNumbers(pages, pageCount);
          if (!pageValidation.valid) {
            return createErrorResult(
              'PAGE_OUT_OF_RANGE',
              `Invalid pages: ${pageValidation.invalidPages?.join(', ')} (document has ${pageCount} pages)`,
              0
            );
          }
          // Create individual ranges for each specified page
          for (const page of pages) {
            splitRanges.push({ start: page, end: page });
          }
        } else {
          // Default: split into individual pages
          for (let i = 1; i <= pageCount; i++) {
            splitRanges.push({ start: i, end: i });
          }
        }
    }

    reportProgress(2, 50);

    // Stage 3: Create split documents
    reportProgress(3, 0);

    const splitFiles: SplitFile[] = [];
    let originalSize = bytes.byteLength;
    let totalProcessedSize = 0;

    for (let i = 0; i < splitRanges.length; i++) {
      const range = splitRanges[i]!;

      // Create new document for this range
      const newDoc = await PDFDocument.create();

      // Copy pages (pdf-lib uses 0-indexed pages)
      const pageIndices = Array.from(
        { length: range.end - range.start + 1 },
        (_, idx) => range.start - 1 + idx
      );

      const copiedPages = await newDoc.copyPages(sourceDoc, pageIndices);
      for (const page of copiedPages) {
        newDoc.addPage(page);
      }

      // Set metadata
      setMetadata(newDoc, {
        producer: 'PDFLover',
        modificationDate: new Date(),
      });

      // Save the document
      const savedBytes = await newDoc.save();
      const savedBuffer = savedBytes.buffer as ArrayBuffer;
      totalProcessedSize += savedBuffer.byteLength;

      // Generate filename
      let filename: string;
      if (mode === 'single' || splitRanges.length === pageCount) {
        filename = `${outputPrefix}_page${range.start}.pdf`;
      } else if (range.start === range.end) {
        filename = `${outputPrefix}_page${range.start}.pdf`;
      } else {
        filename = `${outputPrefix}_pages${range.start}-${range.end}.pdf`;
      }

      splitFiles.push({
        filename,
        data: savedBuffer,
        pageCount: copiedPages.length,
      });

      reportProgress(3, ((i + 1) / splitRanges.length) * 100, i + 1, splitRanges.length);
    }

    return {
      success: true,
      files: splitFiles,
      originalSize,
      processedSize: totalProcessedSize,
      duration: 0,
    };
  });

  return { ...result, duration };
}

/**
 * Extract specific pages from a PDF
 *
 * @param document - Source PDF document or ArrayBuffer
 * @param pages - Array of page numbers to extract (1-indexed)
 * @param outputFilename - Optional output filename
 * @returns ProcessingResult with extracted pages as single PDF
 */
export async function extractPages(
  document: ArrayBuffer | PDFDocumentType,
  pages: number[],
  outputFilename = 'extracted.pdf'
): Promise<ProcessingResult> {
  const bytes = getPDFBytes(document);

  const { result, duration } = await measureTime(async () => {
    // Validate
    const validation = validatePDFBuffer(bytes);
    if (!validation.valid) {
      return createErrorResult(validation.errorCode!, validation.errorMessage!, 0);
    }

    // Load source
    let sourceDoc: PDFDocument;
    try {
      sourceDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    } catch {
      return createErrorResult('CORRUPTED_PDF', ERROR_MESSAGES.CORRUPTED_PDF, 0);
    }

    const pageCount = sourceDoc.getPageCount();

    // Validate pages
    const pageValidation = validatePageNumbers(pages, pageCount);
    if (!pageValidation.valid) {
      return createErrorResult(
        'PAGE_OUT_OF_RANGE',
        `Invalid pages: ${pageValidation.invalidPages?.join(', ')}`,
        0
      );
    }

    // Create new document with extracted pages
    const newDoc = await PDFDocument.create();

    // Sort pages and remove duplicates
    const uniquePages = [...new Set(pages)].sort((a, b) => a - b);
    const pageIndices = uniquePages.map((p) => p - 1);

    const copiedPages = await newDoc.copyPages(sourceDoc, pageIndices);
    for (const page of copiedPages) {
      newDoc.addPage(page);
    }

    setMetadata(newDoc, {
      producer: 'PDFLover',
      modificationDate: new Date(),
    });

    const savedBytes = await newDoc.save();
    const savedBuffer = savedBytes.buffer as ArrayBuffer;

    return {
      success: true,
      data: savedBuffer,
      files: [
        {
          filename: outputFilename,
          data: savedBuffer,
          pageCount: copiedPages.length,
        },
      ],
      originalSize: bytes.byteLength,
      processedSize: savedBuffer.byteLength,
      duration: 0,
    };
  });

  return { ...result, duration };
}

/**
 * Remove specific pages from a PDF
 *
 * @param document - Source PDF document or ArrayBuffer
 * @param pagesToRemove - Array of page numbers to remove (1-indexed)
 * @returns ProcessingResult with PDF minus removed pages
 */
export async function removePages(
  document: ArrayBuffer | PDFDocumentType,
  pagesToRemove: number[]
): Promise<ProcessingResult> {
  const bytes = getPDFBytes(document);

  const { result, duration } = await measureTime(async () => {
    const validation = validatePDFBuffer(bytes);
    if (!validation.valid) {
      return createErrorResult(validation.errorCode!, validation.errorMessage!, 0);
    }

    let sourceDoc: PDFDocument;
    try {
      sourceDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    } catch {
      return createErrorResult('CORRUPTED_PDF', ERROR_MESSAGES.CORRUPTED_PDF, 0);
    }

    const pageCount = sourceDoc.getPageCount();
    const removeSet = new Set(pagesToRemove);

    // Get pages to keep
    const pagesToKeep: number[] = [];
    for (let i = 1; i <= pageCount; i++) {
      if (!removeSet.has(i)) {
        pagesToKeep.push(i);
      }
    }

    if (pagesToKeep.length === 0) {
      return createErrorResult(
        'PAGE_OUT_OF_RANGE',
        'Cannot remove all pages from the document',
        0
      );
    }

    // Extract pages to keep
    return extractPages(document, pagesToKeep, 'modified.pdf');
  });

  return { ...result, duration };
}

/**
 * Split PDF into equal parts
 *
 * @param document - Source PDF document or ArrayBuffer
 * @param parts - Number of parts to split into
 * @returns ProcessingResult with split files
 */
export async function splitIntoParts(
  document: ArrayBuffer | PDFDocumentType,
  parts: number
): Promise<ProcessingResult> {
  const bytes = getPDFBytes(document);

  const validation = validatePDFBuffer(bytes);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.errorMessage,
      errorCode: validation.errorCode,
      duration: 0,
    };
  }

  let sourceDoc: PDFDocument;
  try {
    sourceDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
  } catch {
    return {
      success: false,
      error: ERROR_MESSAGES.CORRUPTED_PDF,
      errorCode: 'CORRUPTED_PDF',
      duration: 0,
    };
  }

  const pageCount = sourceDoc.getPageCount();
  const pagesPerPart = Math.ceil(pageCount / parts);

  const ranges: PageRange[] = [];
  for (let i = 0; i < parts; i++) {
    const start = i * pagesPerPart + 1;
    const end = Math.min((i + 1) * pagesPerPart, pageCount);
    if (start <= pageCount) {
      ranges.push({ start, end });
    }
  }

  return splitPDF({
    document,
    mode: 'range',
    ranges,
    outputPrefix: 'part',
  });
}
