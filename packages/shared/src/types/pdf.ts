/**
 * PDF-related type definitions for PDFLover
 */

/**
 * Represents metadata associated with a PDF document
 */
export interface PDFMetadata {
  /** Document title */
  title?: string;
  /** Document author */
  author?: string;
  /** Document subject */
  subject?: string;
  /** Keywords associated with the document */
  keywords?: string[];
  /** Document creator application */
  creator?: string;
  /** PDF producer application */
  producer?: string;
  /** Document creation date */
  creationDate?: Date;
  /** Document modification date */
  modificationDate?: Date;
  /** PDF version (e.g., "1.7") */
  pdfVersion?: string;
  /** Whether the document is encrypted */
  isEncrypted?: boolean;
  /** Whether the document is linearized (web-optimized) */
  isLinearized?: boolean;
}

/**
 * Represents a single page within a PDF document
 */
export interface PDFPage {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Page width in points (72 points = 1 inch) */
  width: number;
  /** Page height in points */
  height: number;
  /** Page rotation in degrees (0, 90, 180, 270) */
  rotation: 0 | 90 | 180 | 270;
  /** Optional thumbnail data URL */
  thumbnail?: string;
  /** Extracted text content from the page */
  textContent?: string;
}

/**
 * Represents a PDF document with its metadata and pages
 */
export interface PDFDocument {
  /** Unique identifier for the document */
  id: string;
  /** Original filename */
  filename: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type */
  mimeType: 'application/pdf';
  /** Total number of pages */
  pageCount: number;
  /** Document metadata */
  metadata: PDFMetadata;
  /** Array of page information */
  pages: PDFPage[];
  /** Raw PDF data as ArrayBuffer */
  data?: ArrayBuffer;
  /** Document creation timestamp */
  createdAt: Date;
  /** Document last modified timestamp */
  updatedAt: Date;
}

/**
 * Options for merging multiple PDF documents
 */
export interface MergeOptions {
  /** Array of PDF documents or ArrayBuffers to merge */
  documents: (PDFDocument | ArrayBuffer)[];
  /** Optional output filename */
  outputFilename?: string;
  /** Whether to preserve bookmarks/outlines from source documents */
  preserveBookmarks?: boolean;
  /** Optional metadata for the merged document */
  metadata?: Partial<PDFMetadata>;
  /** Progress callback for tracking merge progress */
  onProgress?: ProgressCallback;
}

/**
 * Split mode options
 */
export type SplitMode =
  | 'single'      // Split into single pages
  | 'range'       // Split by page ranges
  | 'size'        // Split by file size
  | 'bookmark';   // Split by bookmarks/chapters

/**
 * Page range specification for splitting
 */
export interface PageRange {
  /** Start page (1-indexed, inclusive) */
  start: number;
  /** End page (1-indexed, inclusive) */
  end: number;
}

/**
 * Options for splitting a PDF document
 */
export interface SplitOptions {
  /** The PDF document or ArrayBuffer to split */
  document: PDFDocument | ArrayBuffer;
  /** Split mode */
  mode: SplitMode;
  /** Page ranges (required for 'range' mode) */
  ranges?: PageRange[];
  /** Specific pages to extract (1-indexed) */
  pages?: number[];
  /** Maximum file size in bytes (for 'size' mode) */
  maxSizeBytes?: number;
  /** Output filename prefix */
  outputPrefix?: string;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Supported output formats for PDF conversion
 */
export type ConvertOutputFormat =
  | 'png'
  | 'jpg'
  | 'jpeg'
  | 'webp'
  | 'svg'
  | 'txt'
  | 'html'
  | 'docx'
  | 'xlsx'
  | 'pptx';

/**
 * Image quality settings
 */
export type ImageQuality = 'low' | 'medium' | 'high' | 'maximum';

/**
 * Options for converting PDF to other formats
 */
export interface ConvertOptions {
  /** The PDF document or ArrayBuffer to convert */
  document: PDFDocument | ArrayBuffer;
  /** Output format */
  outputFormat: ConvertOutputFormat;
  /** Specific pages to convert (undefined = all pages) */
  pages?: number[];
  /** Image quality (for image outputs) */
  imageQuality?: ImageQuality;
  /** DPI for image outputs (default: 150) */
  dpi?: number;
  /** Whether to include OCR text layer */
  includeOCR?: boolean;
  /** OCR language(s) */
  ocrLanguages?: string[];
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Compression level options
 */
export type CompressionLevel = 'low' | 'medium' | 'high' | 'maximum';

/**
 * Options for compressing a PDF document
 */
export interface CompressOptions {
  /** The PDF document or ArrayBuffer to compress */
  document: PDFDocument | ArrayBuffer;
  /** Compression level */
  level: CompressionLevel;
  /** Maximum image DPI (images above this will be downsampled) */
  maxImageDpi?: number;
  /** Whether to remove metadata */
  removeMetadata?: boolean;
  /** Whether to flatten form fields */
  flattenForms?: boolean;
  /** Whether to remove embedded fonts */
  removeEmbeddedFonts?: boolean;
  /** Whether to grayscale images */
  grayscaleImages?: boolean;
  /** Output filename */
  outputFilename?: string;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Progress information during PDF processing
 */
export interface ProgressInfo {
  /** Current progress (0-100) */
  percentage: number;
  /** Current step/stage description */
  stage: string;
  /** Current item being processed */
  currentItem?: number;
  /** Total items to process */
  totalItems?: number;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
}

/**
 * Callback function for progress updates
 */
export type ProgressCallback = (progress: ProgressInfo) => void;

/**
 * Result of a PDF processing operation
 */
export interface ProcessingResult<T = ArrayBuffer> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data (if successful) */
  data?: T;
  /** Array of result data (for split operations) */
  files?: Array<{
    filename: string;
    data: ArrayBuffer;
    pageCount: number;
  }>;
  /** Original file size in bytes */
  originalSize?: number;
  /** Processed file size in bytes */
  processedSize?: number;
  /** Compression ratio (for compress operations) */
  compressionRatio?: number;
  /** Processing duration in milliseconds */
  duration: number;
  /** Error message (if failed) */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: ProcessingErrorCode;
}

/**
 * Error codes for PDF processing operations
 */
export type ProcessingErrorCode =
  | 'INVALID_PDF'
  | 'ENCRYPTED_PDF'
  | 'CORRUPTED_PDF'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'PAGE_OUT_OF_RANGE'
  | 'INSUFFICIENT_MEMORY'
  | 'PROCESSING_TIMEOUT'
  | 'UNKNOWN_ERROR';

/**
 * PDF processing operation types
 */
export type PDFOperation =
  | 'merge'
  | 'split'
  | 'compress'
  | 'convert'
  | 'rotate'
  | 'watermark'
  | 'protect'
  | 'unlock'
  | 'ocr';

/**
 * Rotation options for PDF pages
 */
export interface RotateOptions {
  /** The PDF document or ArrayBuffer */
  document: PDFDocument | ArrayBuffer;
  /** Rotation angle in degrees (clockwise) */
  angle: 90 | 180 | 270;
  /** Specific pages to rotate (undefined = all pages) */
  pages?: number[];
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Watermark options
 */
export interface WatermarkOptions {
  /** The PDF document or ArrayBuffer */
  document: PDFDocument | ArrayBuffer;
  /** Watermark text */
  text?: string;
  /** Watermark image (as data URL or ArrayBuffer) */
  image?: string | ArrayBuffer;
  /** Opacity (0-1) */
  opacity?: number;
  /** Rotation angle in degrees */
  rotation?: number;
  /** Position on page */
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Specific pages (undefined = all pages) */
  pages?: number[];
  /** Progress callback */
  onProgress?: ProgressCallback;
}
