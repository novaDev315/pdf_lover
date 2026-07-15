/**
 * PDF merge functionality for @pdflover/pdf-core
 */

import { PDFDict, PDFDocument, PDFHexString, PDFName, type PDFRef } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
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

interface PreservedBookmark {
  title: string;
  pageIndex: number;
}

async function extractBookmarks(
  documents: MergeOptions['documents'],
  loadedDocs: PDFDocument[],
): Promise<PreservedBookmark[]> {
  const bookmarks: PreservedBookmark[] = [];
  let pageOffset = 0;
  for (let documentIndex = 0; documentIndex < documents.length; documentIndex++) {
    const bytes = getPDFBytes(documents[documentIndex]!).slice();
    const rendered = await pdfjsLib.getDocument({ data: bytes }).promise;
    try {
      const outline = await rendered.getOutline();
      const visit = async (items: NonNullable<typeof outline>): Promise<void> => {
        for (const item of items) {
          const destination = typeof item.dest === 'string'
            ? await rendered.getDestination(item.dest)
            : item.dest;
          const reference = destination?.[0];
          if (reference !== undefined && reference !== null) {
            const localIndex = typeof reference === 'number'
              ? reference
              : await rendered.getPageIndex(reference);
            if (localIndex >= 0 && localIndex < rendered.numPages && item.title.trim()) {
              bookmarks.push({ title: item.title.trim(), pageIndex: pageOffset + localIndex });
            }
          }
          if (item.items.length > 0) await visit(item.items);
        }
      };
      if (outline) await visit(outline);
    } finally {
      await rendered.destroy();
    }
    pageOffset += loadedDocs[documentIndex]!.getPageCount();
  }
  return bookmarks;
}

function addBookmarks(document: PDFDocument, bookmarks: PreservedBookmark[]): void {
  if (bookmarks.length === 0) return;
  const outline = document.context.obj({ Type: 'Outlines', Count: bookmarks.length }) as PDFDict;
  const outlineRef = document.context.register(outline);
  const itemRefs: PDFRef[] = [];
  const itemDicts: PDFDict[] = [];
  for (const bookmark of bookmarks) {
    const page = document.getPage(bookmark.pageIndex);
    const item = document.context.obj({
      Parent: outlineRef,
      Dest: [page.ref, PDFName.of('Fit')],
    }) as PDFDict;
    item.set(PDFName.of('Title'), PDFHexString.fromText(bookmark.title));
    itemDicts.push(item);
    itemRefs.push(document.context.register(item));
  }
  for (let index = 0; index < itemDicts.length; index++) {
    if (itemRefs[index - 1]) itemDicts[index]!.set(PDFName.of('Prev'), itemRefs[index - 1]!);
    if (itemRefs[index + 1]) itemDicts[index]!.set(PDFName.of('Next'), itemRefs[index + 1]!);
  }
  outline.set(PDFName.of('First'), itemRefs[0]!);
  outline.set(PDFName.of('Last'), itemRefs.at(-1)!);
  document.catalog.set(PDFName.of('Outlines'), outlineRef);
}

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

    if (documents.length === 1) {
      const bytes = getPDFBytes(documents[0]!);
      return createSuccessResult(bytes.buffer as ArrayBuffer, bytes.byteLength, bytes.byteLength, 0);
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

    // Preserve source bookmark titles and destinations. Nested source outlines
    // are flattened because pdf-lib does not expose an outline tree API.
    if (preserveBookmarks) {
      addBookmarks(mergedDoc, await extractBookmarks(documents, loadedDocs));
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
