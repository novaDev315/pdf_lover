/**
 * Constants for PDFLover
 */

/**
 * Maximum PDF file size in bytes (100MB)
 */
export const PDF_MAX_SIZE = 100 * 1024 * 1024;

/**
 * Maximum number of pages for browser processing
 */
export const PDF_MAX_PAGES = 500;

/**
 * Maximum number of documents in a merge operation
 */
export const MERGE_MAX_DOCUMENTS = 50;

/**
 * Default DPI for image conversion
 */
export const DEFAULT_IMAGE_DPI = 150;

/**
 * High quality DPI for image conversion
 */
export const HIGH_QUALITY_IMAGE_DPI = 300;

/**
 * Maximum DPI for image conversion
 */
export const MAX_IMAGE_DPI = 600;

/**
 * Default JPEG quality (0-100)
 */
export const DEFAULT_JPEG_QUALITY = 85;

/**
 * Default PNG compression level (0-9)
 */
export const DEFAULT_PNG_COMPRESSION = 6;

/**
 * Thumbnail size in pixels
 */
export const THUMBNAIL_SIZE = {
  width: 200,
  height: 280,
} as const;

/**
 * Supported input formats for PDF processing
 */
export const SUPPORTED_INPUT_FORMATS = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
] as const;

/**
 * Supported output formats for conversion
 */
export const SUPPORTED_OUTPUT_FORMATS = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'svg',
  'txt',
  'html',
  'docx',
  'xlsx',
  'pptx',
] as const;

/**
 * File extensions for various formats
 */
export const FILE_EXTENSIONS = {
  pdf: '.pdf',
  png: '.png',
  jpg: '.jpg',
  jpeg: '.jpeg',
  webp: '.webp',
  svg: '.svg',
  txt: '.txt',
  html: '.html',
  docx: '.docx',
  xlsx: '.xlsx',
  pptx: '.pptx',
} as const;

/**
 * MIME types for various formats
 */
export const MIME_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  html: 'text/html',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

/**
 * Default chunk size for text splitting (in characters)
 */
export const DEFAULT_CHUNK_SIZE = 1000;

/**
 * Default chunk overlap for text splitting (in characters)
 */
export const DEFAULT_CHUNK_OVERLAP = 200;

/**
 * Maximum chunks to retrieve for RAG context
 */
export const DEFAULT_TOP_K_CHUNKS = 5;

/**
 * Minimum similarity score for RAG retrieval
 */
export const DEFAULT_MIN_SIMILARITY = 0.7;

/**
 * Default embedding model
 */
export const DEFAULT_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

/**
 * Embedding vector dimension for default model
 */
export const EMBEDDING_DIMENSION = 384;

/**
 * Maximum conversation history tokens
 */
export const MAX_CONVERSATION_TOKENS = 4096;

/**
 * Default temperature for AI generation
 */
export const DEFAULT_TEMPERATURE = 0.7;

/**
 * Default maximum tokens for AI generation
 */
export const DEFAULT_MAX_TOKENS = 1024;

/**
 * IndexedDB database name
 */
export const INDEXEDDB_NAME = 'pdflover-db';

/**
 * IndexedDB database version
 */
export const INDEXEDDB_VERSION = 1;

/**
 * IndexedDB store names
 */
export const INDEXEDDB_STORES = {
  documents: 'documents',
  documentData: 'document-data',
  conversations: 'conversations',
  embeddings: 'embeddings',
  settings: 'settings',
  folders: 'folders',
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  theme: 'pdflover-theme',
  locale: 'pdflover-locale',
  recentDocuments: 'pdflover-recent',
  preferences: 'pdflover-preferences',
  aiProvider: 'pdflover-ai-provider',
} as const;

/**
 * Default storage quota warning threshold (80%)
 */
export const STORAGE_QUOTA_WARNING_THRESHOLD = 0.8;

/**
 * Processing timeout in milliseconds (5 minutes)
 */
export const PROCESSING_TIMEOUT = 5 * 60 * 1000;

/**
 * OCR supported languages
 */
export const OCR_LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'deu', name: 'German' },
  { code: 'fra', name: 'French' },
  { code: 'spa', name: 'Spanish' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'nld', name: 'Dutch' },
  { code: 'pol', name: 'Polish' },
  { code: 'rus', name: 'Russian' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'chi_tra', name: 'Chinese (Traditional)' },
  { code: 'kor', name: 'Korean' },
  { code: 'ara', name: 'Arabic' },
  { code: 'hin', name: 'Hindi' },
] as const;

/**
 * Default OCR language
 */
export const DEFAULT_OCR_LANGUAGE = 'eng';

/**
 * Compression level settings
 */
export const COMPRESSION_SETTINGS = {
  low: {
    imageQuality: 0.9,
    maxImageDpi: 300,
  },
  medium: {
    imageQuality: 0.7,
    maxImageDpi: 200,
  },
  high: {
    imageQuality: 0.5,
    maxImageDpi: 150,
  },
  maximum: {
    imageQuality: 0.3,
    maxImageDpi: 100,
  },
} as const;

/**
 * API rate limits (requests per minute)
 */
export const API_RATE_LIMITS = {
  openrouter: 60,
  openai: 60,
  anthropic: 60,
} as const;

/**
 * Web Worker script paths
 */
export const WORKER_PATHS = {
  pdfWorker: '/workers/pdf.worker.js',
  ocrWorker: '/workers/ocr.worker.js',
  aiWorker: '/workers/ai.worker.js',
} as const;

/**
 * Feature flags
 */
export const FEATURE_FLAGS = {
  enableOCR: true,
  enableAI: true,
  enableCloudSync: false,
  enableOfficeConversion: false,
  enableWebGPU: true,
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  INVALID_PDF: 'The file is not a valid PDF document.',
  ENCRYPTED_PDF: 'The PDF is password-protected. Please unlock it first.',
  CORRUPTED_PDF: 'The PDF file appears to be corrupted.',
  FILE_TOO_LARGE: `The file exceeds the maximum size of ${PDF_MAX_SIZE / 1024 / 1024}MB.`,
  UNSUPPORTED_FORMAT: 'This file format is not supported.',
  PAGE_OUT_OF_RANGE: 'One or more page numbers are out of range.',
  INSUFFICIENT_MEMORY: 'Not enough memory to process this file.',
  PROCESSING_TIMEOUT: 'The operation timed out. Try with a smaller file.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  STORAGE_QUOTA_EXCEEDED: 'Storage quota exceeded. Please delete some files.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  AI_UNAVAILABLE: 'AI service is currently unavailable.',
} as const;
