/**
 * @pdflover/pdf-core
 *
 * PDF processing library for PDFLover
 * All processing runs in the browser - no server uploads required
 */

// Merge operations
export { mergePDFs, mergePDFFiles, quickMerge } from './merge.js';

// Split operations
export {
  splitPDF,
  extractPages,
  removePages,
  splitIntoParts,
} from './split.js';

// Compress operations
export {
  compressPDF,
  quickCompress,
  estimateCompression,
  optimizePDF,
} from './compress.js';

// Convert operations
export {
  convertPDF,
  extractText,
  getSupportedFormats,
} from './convert.js';

// Utility functions
export {
  loadPDFDocument,
  getPDFBytes,
  validatePDFBuffer,
  extractMetadata,
  setMetadata,
  getPageInfo,
  validatePageNumbers,
  createProgressReporter,
  measureTime,
  normalizeRotation,
} from './utils.js';

// Re-export pdf-lib for advanced use cases
export { PDFDocument } from 'pdf-lib';
