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
  htmlToPDF,
  markdownToPDF,
  extractTextWithOCR,
  addTextLayerToPDF,
} from './convert.js';

export type {
  HTMLToPDFOptions,
  MarkdownToPDFOptions,
  OCRTextExtractionOptions,
} from './convert.js';

// OCR operations
export {
  initializeOCR,
  terminateOCR,
  recognizeText,
  ocrImages,
  ocrPDF,
  createSearchablePDFData,
  getAvailableLanguages,
  isValidLanguageCode,
  estimateOCRTime,
  OCR_LANGUAGES,
} from './ocr.js';

export type {
  OCRLanguageCode,
  TextBoundingBox,
  RecognizedWord,
  RecognizedLine,
  RecognizedParagraph,
  RecognizedBlock,
  OCRPageResult,
  OCRResult,
  OCROptions,
  SearchablePDFOptions,
} from './ocr.js';

// Security operations
export {
  encryptPDF,
  decryptPDF,
  setPermissions,
  getPermissions,
  isEncrypted,
  getSecurityInfo,
  validatePassword,
} from './security.js';

export type {
  EncryptionLevel,
  PDFPermissions,
  EncryptOptions,
  DecryptOptions,
  PDFSecurityInfo,
} from './security.js';

// Watermark operations
export {
  addTextWatermark,
  addImageWatermark,
  removeWatermark,
} from './watermark.js';

export type {
  WatermarkPosition,
  TextWatermarkOptions,
  ImageWatermarkOptions,
} from './watermark.js';

// Signature operations
export {
  createSignatureField,
  signPDF,
  verifySignature,
  getSignatures,
  getSignatureFields,
  hasSignatures,
} from './signature.js';

export type {
  SignatureRect,
  SignatureField,
  SignatureType,
  SignOptions,
  CreateFieldOptions,
  VerificationResult,
  SignatureInfo,
} from './signature.js';

// Edit operations
export {
  addTextAnnotation,
  addHighlight,
  addUnderline,
  addStrikethrough,
  addFreehandDrawing,
  addShape,
  addImage,
  addTextField,
  addCheckbox,
  removeAnnotation,
  flattenForm,
} from './edit.js';

export type {
  Rect,
  Point,
  Color,
  TextAnnotationOptions,
  MarkupOptions,
  FreehandOptions,
  ShapeType,
  ShapeOptions,
  ImageOptions,
  TextFieldOptions,
  CheckboxOptions,
  AnnotationMetadata,
  EditResult,
} from './edit.js';

// Redact operations
export {
  RedactionManager,
  redactArea,
  redactText,
  applyRedactions,
  sanitizePDF,
  previewRedactions,
} from './redact.js';

export type {
  RedactionEntry,
  RedactionOptions,
  TextSearchResult,
} from './redact.js';

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
