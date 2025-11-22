/**
 * PDF compression functionality for @pdflover/pdf-core
 *
 * Note: True PDF compression requires manipulating internal streams and images.
 * pdf-lib provides basic compression through its save options, but for advanced
 * compression (image downsampling, font subsetting), additional tools are needed.
 */

import { PDFDocument } from 'pdf-lib';
import type {
  CompressOptions,
  ProcessingResult,
  CompressionLevel,
  PDFDocument as PDFDocumentType,
} from '@pdflover/shared';
import { COMPRESSION_SETTINGS, ERROR_MESSAGES } from '@pdflover/shared';
import {
  loadPDFDocument,
  validatePDFBuffer,
  createErrorResult,
  createProgressReporter,
  measureTime,
  getPDFBytes,
  setMetadata,
  extractMetadata,
} from './utils.js';

/**
 * Compression settings for different levels
 */
interface CompressionConfig {
  useObjectStreams: boolean;
  addDefaultPage: boolean;
  objectsPerTick: number;
}

/**
 * Get compression configuration for a level
 */
function getCompressionConfig(level: CompressionLevel): CompressionConfig {
  switch (level) {
    case 'low':
      return {
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 100,
      };
    case 'medium':
      return {
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
      };
    case 'high':
    case 'maximum':
      return {
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 20,
      };
  }
}

/**
 * Compress a PDF document
 *
 * Note: Browser-based compression is limited. For best results:
 * - pdf-lib applies basic stream compression
 * - Metadata can be optionally stripped
 * - Form flattening reduces interactive elements
 *
 * For aggressive compression (image downsampling), a server-side solution
 * with tools like Ghostscript would be more effective.
 *
 * @param options - Compression options
 * @returns ProcessingResult with compressed PDF
 *
 * @example
 * ```typescript
 * const result = await compressPDF({
 *   document: pdfArrayBuffer,
 *   level: 'medium',
 *   removeMetadata: true,
 *   onProgress: (info) => console.log(`${info.percentage}%`),
 * });
 *
 * if (result.success && result.compressionRatio) {
 *   console.log(`Compressed to ${(100 / result.compressionRatio).toFixed(1)}% of original`);
 * }
 * ```
 */
export async function compressPDF(options: CompressOptions): Promise<ProcessingResult> {
  const {
    document,
    level,
    removeMetadata = false,
    flattenForms = false,
    onProgress,
  } = options;

  const stages = ['Validating', 'Loading document', 'Compressing', 'Finalizing'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    const bytes = getPDFBytes(document);
    const originalSize = bytes.byteLength;

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

    // Stage 2: Create compressed copy
    reportProgress(2, 0);

    // Create a new document and copy all pages
    // This helps remove unused objects and optimize structure
    const compressedDoc = await PDFDocument.create();

    // Copy all pages
    const pageIndices = Array.from({ length: pageCount }, (_, i) => i);
    const copiedPages = await compressedDoc.copyPages(sourceDoc, pageIndices);

    for (let i = 0; i < copiedPages.length; i++) {
      compressedDoc.addPage(copiedPages[i]!);
      reportProgress(2, ((i + 1) / copiedPages.length) * 50, i + 1, copiedPages.length);
    }

    // Handle form flattening
    // Note: pdf-lib doesn't have built-in form flattening
    // This would require additional processing for each form field
    if (flattenForms) {
      const form = compressedDoc.getForm();
      try {
        // Flatten all form fields - this makes them non-editable
        form.flatten();
      } catch {
        // Form flattening might fail if there are no forms or they're corrupted
        // Continue without flattening
      }
    }

    reportProgress(2, 75);

    // Stage 3: Finalize
    reportProgress(3, 0);

    // Handle metadata
    if (!removeMetadata) {
      // Preserve original metadata
      const originalMetadata = extractMetadata(sourceDoc);
      setMetadata(compressedDoc, {
        ...originalMetadata,
        producer: 'PDFLover',
        modificationDate: new Date(),
      });
    } else {
      // Only set minimal metadata
      setMetadata(compressedDoc, {
        producer: 'PDFLover',
        modificationDate: new Date(),
      });
    }

    reportProgress(3, 50);

    // Get compression config
    const config = getCompressionConfig(level);

    // Save with compression options
    const compressedBytes = await compressedDoc.save({
      useObjectStreams: config.useObjectStreams,
      addDefaultPage: config.addDefaultPage,
      objectsPerTick: config.objectsPerTick,
    });

    const compressedBuffer = compressedBytes.buffer as ArrayBuffer;
    const processedSize = compressedBuffer.byteLength;

    reportProgress(3, 100);

    // Calculate compression ratio
    const compressionRatio = processedSize < originalSize ? originalSize / processedSize : undefined;

    return {
      success: true,
      data: compressedBuffer,
      originalSize,
      processedSize,
      compressionRatio,
      duration: 0,
    };
  });

  return { ...result, duration };
}

/**
 * Quick compress utility with default settings
 *
 * @param buffer - PDF ArrayBuffer
 * @param level - Compression level (default: 'medium')
 * @returns Compressed PDF as ArrayBuffer, or null on failure
 */
export async function quickCompress(
  buffer: ArrayBuffer,
  level: CompressionLevel = 'medium'
): Promise<ArrayBuffer | null> {
  const result = await compressPDF({
    document: buffer,
    level,
  });

  return result.success && result.data ? result.data : null;
}

/**
 * Estimate potential compression savings
 *
 * This provides a rough estimate based on document characteristics.
 * Actual compression results may vary.
 *
 * @param document - PDF document or ArrayBuffer
 * @returns Estimated compression percentage (0-100)
 */
export async function estimateCompression(
  document: ArrayBuffer | PDFDocumentType
): Promise<{ estimatedSavings: number; hasImages: boolean; hasForms: boolean }> {
  const bytes = getPDFBytes(document);
  const originalSize = bytes.byteLength;

  try {
    const sourceDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    const pageCount = sourceDoc.getPageCount();

    // Check for forms
    let hasForms = false;
    try {
      const form = sourceDoc.getForm();
      hasForms = form.getFields().length > 0;
    } catch {
      hasForms = false;
    }

    // Estimate based on document characteristics
    // This is a rough heuristic
    const avgBytesPerPage = originalSize / pageCount;

    // If average page size is large, likely has images
    const hasImages = avgBytesPerPage > 100000; // > 100KB per page suggests images

    // Estimate savings
    let estimatedSavings = 5; // Base savings from optimization

    if (hasImages) {
      estimatedSavings += 20; // Images can often be compressed more
    }

    if (hasForms) {
      estimatedSavings += 5; // Forms add some bloat
    }

    // Large documents often have more redundancy
    if (pageCount > 50) {
      estimatedSavings += 10;
    }

    return {
      estimatedSavings: Math.min(estimatedSavings, 50), // Cap at 50%
      hasImages,
      hasForms,
    };
  } catch {
    return {
      estimatedSavings: 10,
      hasImages: false,
      hasForms: false,
    };
  }
}

/**
 * Optimize PDF without aggressive compression
 *
 * This performs structural optimization without affecting quality:
 * - Removes unused objects
 * - Optimizes object streams
 * - Cleans up document structure
 *
 * @param document - PDF document or ArrayBuffer
 * @returns ProcessingResult with optimized PDF
 */
export async function optimizePDF(
  document: ArrayBuffer | PDFDocumentType
): Promise<ProcessingResult> {
  return compressPDF({
    document,
    level: 'low',
    removeMetadata: false,
    flattenForms: false,
  });
}
