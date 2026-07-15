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
  getPermissions,
  isEncrypted,
  getSecurityInfo,
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
  createSignaturePlaceholder,
  signPDF,
  inspectVisualSignatures,
  getVisualSignatures,
  getSignaturePlaceholders,
  hasVisualSignatures,
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

// Search operations
export {
  searchText,
  searchTextInPdf,
  replaceText,
  highlightSearchResults,
  getTextContent,
  countMatches,
  previewReplacements,
} from './search.js';

export type {
  SearchOptions,
  ReplaceOptions,
  SearchResult,
  TextContentItem,
  PageTextContent,
  DocumentTextContent,
  ReplaceResult,
  HighlightOptions,
} from './search.js';

// Compare operations
export {
  comparePDFs,
  compareText,
  compareVisual,
  comparePages,
  generateDiffReport,
  arePDFsIdentical,
} from './compare.js';

export type {
  DifferenceType,
  Difference,
  TextLine,
  LineDiff,
  PageComparison,
  ComparisonSummary,
  ComparisonResult,
  CompareOptions,
  VisualCompareOptions,
  VisualPageDiff,
  TextComparisonResult,
} from './compare.js';

// Image extraction operations
export {
  extractImages,
  extractImagesAsBlobs,
  getImageCount,
  extractImageMetadata,
  createImageFilename,
} from './extract-images.js';

export type {
  ExtractedImage,
  ImageMetadata,
  ExtractImagesOptions,
  ExtractImagesResult,
  ImageCountResult,
} from './extract-images.js';

// Table extraction operations
export {
  extractTables,
  detectTableRegions,
  parseTableStructure,
  tableToCSV,
  tablesToCSV,
  tableToExcel,
  tablesToExcel,
  tableToJSON,
  tablesToJSON,
  getTableCount,
  createTableFilename,
} from './extract-tables.js';

export type {
  TableBounds,
  TableCell,
  ExtractedTable,
  TableRegion,
  ExtractTablesOptions,
  ExtractTablesResult,
  TableCountResult,
  ExcelWorksheet,
  ExcelWorkbook,
} from './extract-tables.js';

// Page transformation operations
export {
  cropPages,
  resizePages,
  trimMargins,
  setPageSize,
  rotatePagesAdvanced,
  getPageDimensions,
  applyUniformMargins,
  PAGE_SIZES,
  toPoints,
  fromPoints,
} from './page-transform.js';

export type {
  CropBox,
  CropBoxPercent,
  CropOptions,
  ResizeOptions,
  TrimOptions,
  SetPageSizeOptions,
  RotateAdvancedOptions,
  PageSizeName,
  DimensionUnit,
} from './page-transform.js';

// Page elements operations (page numbers, headers, footers)
export {
  addPageNumbers,
  addHeader,
  addFooter,
  removePageNumbers,
  addBatesNumbering,
  STANDARD_FONTS,
  PAGE_NUMBER_FORMATS,
  POSITION_LABELS,
} from './page-elements.js';

export type {
  PageElementPosition,
  StandardFontName,
  PageNumberFormat,
  PageNumberOptions,
  HeaderOptions,
  FooterOptions,
  BatesNumberOptions,
} from './page-elements.js';

// Document classification operations
export {
  classifyDocument,
  batchClassifyDocuments,
  extractDocumentFeatures,
  detectKeywords,
  analyzeStructure,
  extractEntities,
  calculateTextStats,
  getDocumentTypeLabel,
  getDocumentTypeDescription,
  getDocumentTypes,
} from './classify.js';

export type {
  DocumentType,
  ConfidenceLevel,
  Classification,
  DocumentFeatures,
  KeywordMatch,
  DocumentStructure,
  ExtractedEntities,
  DocumentMetadata,
  TextStatistics,
  ClassifyOptions,
} from './classify.js';

// Table of Contents operations
export {
  generateTOC,
  insertTOC,
  extractHeadings,
  detectHeadingStyles,
  generateAndInsertTOC,
  buildTOCHierarchy,
  flattenTOCHierarchy,
  createTOCEntry,
} from './toc.js';

export type {
  TOCEntry,
  HeadingStyle,
  GenerateTOCOptions,
  InsertTOCOptions,
} from './toc.js';

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

// Form detection operations
export {
  detectFormFields,
  analyzeFormStructure,
  createFormFields,
  suggestFieldTypes,
  detectLabels,
  getFormFields,
  isFormDocument,
} from './form-detection.js';

export type {
  FormFieldType,
  FieldBounds,
  DetectedField,
  FieldGroup,
  DetectedLabel,
  FormStructure,
  FormDetectionOptions,
  CreateFieldsOptions,
} from './form-detection.js';

// Key information extraction operations
export {
  extractKeyInformation,
  extractDates,
  extractAmounts,
  extractNames,
  extractEmails,
  extractPhones,
  extractAddresses,
  extractURLs,
  extractIDs,
  extractCustomPatterns,
  exportToJSON,
  exportToCSV,
} from './extract-info.js';

export type {
  TextLocation,
  ExtractedDate,
  DateFormat,
  ExtractedAmount,
  ExtractedName,
  ExtractedEmail,
  ExtractedPhone,
  PhoneFormat,
  ExtractedAddress,
  ExtractedURL,
  ExtractedID,
  IDType,
  CustomPattern,
  CustomPatternMatch,
  ExtractedInfo,
  ExtractionSummary,
  ExtractInfoOptions,
  PageText,
} from './extract-info.js';

// Re-export pdf-lib for advanced use cases
export { PDFDocument } from 'pdf-lib';
