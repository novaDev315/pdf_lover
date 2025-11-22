/**
 * PDF merge functionality for @pdflover/pdf-core
 */

import { PDFDocument } from 'pdf-lib';
import type {
  MergeOptions,
  ProcessingResult,
  PDFDocument as PDFDocumentType,
} from '@pdflover/shared';
import { MERGE_MAX_DOCUMENTS, ERROR_MESSAGES } from '@pdflover/shared';
import {
  loadPDFDocument,
  validatePDFBuffer,
  setMetadata,
  createErrorResult,
  createSuccessResult,
  createProgressReporter,
  measureTime,
  getPDFBytes,
} from './utils.js';

/**
 * Merge multiple PDF documents into a single document
 *
 * @param options - Merge options including documents array and optional settings
 * @returns ProcessingResult with merged PDF data
 *
 * @example
 * ```typescript
 * const result = await mergePDFs({
 *   documents: [pdf1ArrayBuffer, pdf2ArrayBuffer],
 *   outputFilename: 'merged.pdf',
 *   preserveBookmarks: true,
 *   onProgress: (info) => console.log(`${info.percentage}%`),
 * });
 *
 * if (result.success) {
 *   // result.data contains the merged PDF as ArrayBuffer
 * }
 * ```
 */
export async function mergePDFs(options: MergeOptions): Promise<ProcessingResult> {
  const { documents, preserveBookmarks = false, metadata, onProgress } = options;

  const stages = ['Validating documents', 'Loading documents', 'Merging pages', 'Finalizing'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    if (!documents || documents.length === 0) {
      return createErrorResult(
        'INVALID_PDF',
        'No documents provided for merging',
        0
      );
    }

    if (documents.length === 1) {
      // Single document - just return it
      const singleDoc = documents[0]!;
      const bytes = getPDFBytes(singleDoc);
      return createSuccessResult(bytes.buffer as ArrayBuffer, bytes.byteLength, bytes.byteLength, 0);
    }

    if (documents.length > MERGE_MAX_DOCUMENTS) {
      return createErrorResult(
        'FILE_TOO_LARGE',
        `Cannot merge more than ${MERGE_MAX_DOCUMENTS} documents at once`,
        0
      );
    }

    // Validate all documents
    let totalOriginalSize = 0;
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]!;
      const bytes = getPDFBytes(doc);
      const validation = validatePDFBuffer(bytes);

      if (!validation.valid) {
        return createErrorResult(
          validation.errorCode!,
          `Document ${i + 1}: ${validation.errorMessage}`,
          0
        );
      }

      totalOriginalSize += bytes.byteLength;
      reportProgress(0, ((i + 1) / documents.length) * 100);
    }

    // Stage 1: Load all documents
    reportProgress(1, 0);
    const loadedDocs: PDFDocument[] = [];

    try {
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i]!;
        const loaded = await loadPDFDocument(doc as ArrayBuffer | PDFDocumentType);
        loadedDocs.push(loaded);
        reportProgress(1, ((i + 1) / documents.length) * 100, i + 1, documents.length);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('encrypt')) {
        return createErrorResult('ENCRYPTED_PDF', ERROR_MESSAGES.ENCRYPTED_PDF, 0);
      }
      return createErrorResult('CORRUPTED_PDF', ERROR_MESSAGES.CORRUPTED_PDF, 0);
    }

    // Stage 2: Create merged document and copy pages
    reportProgress(2, 0);
    const mergedDoc = await PDFDocument.create();

    let totalPages = 0;
    const totalPagesCount = loadedDocs.reduce((sum, doc) => sum + doc.getPageCount(), 0);

    for (let docIndex = 0; docIndex < loadedDocs.length; docIndex++) {
      const sourceDoc = loadedDocs[docIndex]!;
      const pageCount = sourceDoc.getPageCount();

      // Copy all pages from this document
      const copiedPages = await mergedDoc.copyPages(
        sourceDoc,
        Array.from({ length: pageCount }, (_, i) => i)
      );

      for (const page of copiedPages) {
        mergedDoc.addPage(page);
        totalPages++;
        reportProgress(2, (totalPages / totalPagesCount) * 100, totalPages, totalPagesCount);
      }
    }

    // Stage 3: Finalize
    reportProgress(3, 0);

    // Set metadata
    if (metadata) {
      setMetadata(mergedDoc, metadata);
    } else {
      // Default metadata
      mergedDoc.setProducer('PDFLover');
      mergedDoc.setModificationDate(new Date());
    }

    // Copy bookmarks/outlines if requested
    if (preserveBookmarks) {
      // Note: pdf-lib has limited bookmark support
      // For full bookmark merging, additional processing would be needed
      // This is a placeholder for future enhancement
    }

    reportProgress(3, 50);

    // Save the merged document
    const mergedBytes = await mergedDoc.save();
    const mergedBuffer = mergedBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return {
      success: true,
      data: mergedBuffer,
      originalSize: totalOriginalSize,
      processedSize: mergedBuffer.byteLength,
      duration: 0, // Will be set by measureTime
    };
  });

  // Add duration to result
  if (result.success) {
    return { ...result, duration };
  }
  return { ...result, duration };
}

/**
 * Merge PDFs from File objects (browser convenience method)
 *
 * @param files - Array of File objects containing PDFs
 * @param options - Optional merge settings
 * @returns ProcessingResult with merged PDF data
 */
export async function mergePDFFiles(
  files: File[],
  options?: Omit<MergeOptions, 'documents'>
): Promise<ProcessingResult> {
  const documents: ArrayBuffer[] = [];

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    documents.push(buffer);
  }

  return mergePDFs({
    ...options,
    documents,
    outputFilename: options?.outputFilename ?? 'merged.pdf',
  });
}

/**
 * Quick merge utility for simple cases
 *
 * @param buffers - Array of PDF ArrayBuffers
 * @returns Merged PDF as ArrayBuffer, or null on failure
 */
export async function quickMerge(buffers: ArrayBuffer[]): Promise<ArrayBuffer | null> {
  const result = await mergePDFs({ documents: buffers });
  return result.success && result.data ? result.data : null;
}
