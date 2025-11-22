/**
 * Tests for shared constants
 */

import { describe, it, expect } from 'vitest';
import {
  PDF_MAX_SIZE,
  PDF_MAX_PAGES,
  MERGE_MAX_DOCUMENTS,
  DEFAULT_IMAGE_DPI,
  HIGH_QUALITY_IMAGE_DPI,
  MAX_IMAGE_DPI,
  DEFAULT_JPEG_QUALITY,
  DEFAULT_PNG_COMPRESSION,
  THUMBNAIL_SIZE,
  SUPPORTED_INPUT_FORMATS,
  SUPPORTED_OUTPUT_FORMATS,
  FILE_EXTENSIONS,
  MIME_TYPES,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_TOP_K_CHUNKS,
  DEFAULT_MIN_SIMILARITY,
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
  MAX_CONVERSATION_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  INDEXEDDB_NAME,
  INDEXEDDB_VERSION,
  INDEXEDDB_STORES,
  STORAGE_KEYS,
  STORAGE_QUOTA_WARNING_THRESHOLD,
  PROCESSING_TIMEOUT,
  OCR_LANGUAGES,
  DEFAULT_OCR_LANGUAGE,
  COMPRESSION_SETTINGS,
  API_RATE_LIMITS,
  WORKER_PATHS,
  FEATURE_FLAGS,
  ERROR_MESSAGES,
} from '../constants/index.js';

describe('PDF Size Limits', () => {
  it('should have PDF_MAX_SIZE set to 100MB', () => {
    expect(PDF_MAX_SIZE).toBe(100 * 1024 * 1024);
  });

  it('should have PDF_MAX_PAGES set to 500', () => {
    expect(PDF_MAX_PAGES).toBe(500);
  });

  it('should have MERGE_MAX_DOCUMENTS set to 50', () => {
    expect(MERGE_MAX_DOCUMENTS).toBe(50);
  });
});

describe('Image DPI Constants', () => {
  it('should have DEFAULT_IMAGE_DPI set to 150', () => {
    expect(DEFAULT_IMAGE_DPI).toBe(150);
  });

  it('should have HIGH_QUALITY_IMAGE_DPI set to 300', () => {
    expect(HIGH_QUALITY_IMAGE_DPI).toBe(300);
  });

  it('should have MAX_IMAGE_DPI set to 600', () => {
    expect(MAX_IMAGE_DPI).toBe(600);
  });

  it('should have proper DPI hierarchy', () => {
    expect(DEFAULT_IMAGE_DPI).toBeLessThan(HIGH_QUALITY_IMAGE_DPI);
    expect(HIGH_QUALITY_IMAGE_DPI).toBeLessThan(MAX_IMAGE_DPI);
  });
});

describe('Image Quality Constants', () => {
  it('should have DEFAULT_JPEG_QUALITY in valid range', () => {
    expect(DEFAULT_JPEG_QUALITY).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_JPEG_QUALITY).toBeLessThanOrEqual(100);
  });

  it('should have DEFAULT_PNG_COMPRESSION in valid range', () => {
    expect(DEFAULT_PNG_COMPRESSION).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_PNG_COMPRESSION).toBeLessThanOrEqual(9);
  });
});

describe('Thumbnail Size', () => {
  it('should have width and height properties', () => {
    expect(THUMBNAIL_SIZE).toHaveProperty('width');
    expect(THUMBNAIL_SIZE).toHaveProperty('height');
  });

  it('should have reasonable dimensions', () => {
    expect(THUMBNAIL_SIZE.width).toBeGreaterThan(0);
    expect(THUMBNAIL_SIZE.height).toBeGreaterThan(0);
  });
});

describe('Supported Formats', () => {
  it('should include PDF in input formats', () => {
    expect(SUPPORTED_INPUT_FORMATS).toContain('application/pdf');
  });

  it('should include common image formats in input', () => {
    expect(SUPPORTED_INPUT_FORMATS).toContain('image/png');
    expect(SUPPORTED_INPUT_FORMATS).toContain('image/jpeg');
  });

  it('should include PDF in output formats', () => {
    expect(SUPPORTED_OUTPUT_FORMATS).toContain('pdf');
  });

  it('should include image formats in output', () => {
    expect(SUPPORTED_OUTPUT_FORMATS).toContain('png');
    expect(SUPPORTED_OUTPUT_FORMATS).toContain('jpg');
  });

  it('should include document formats in output', () => {
    expect(SUPPORTED_OUTPUT_FORMATS).toContain('docx');
    expect(SUPPORTED_OUTPUT_FORMATS).toContain('xlsx');
  });
});

describe('File Extensions', () => {
  it('should have pdf extension', () => {
    expect(FILE_EXTENSIONS.pdf).toBe('.pdf');
  });

  it('should have image extensions', () => {
    expect(FILE_EXTENSIONS.png).toBe('.png');
    expect(FILE_EXTENSIONS.jpg).toBe('.jpg');
  });

  it('should have document extensions', () => {
    expect(FILE_EXTENSIONS.docx).toBe('.docx');
    expect(FILE_EXTENSIONS.xlsx).toBe('.xlsx');
  });
});

describe('MIME Types', () => {
  it('should have correct PDF MIME type', () => {
    expect(MIME_TYPES.pdf).toBe('application/pdf');
  });

  it('should have correct image MIME types', () => {
    expect(MIME_TYPES.png).toBe('image/png');
    expect(MIME_TYPES.jpg).toBe('image/jpeg');
    expect(MIME_TYPES.jpeg).toBe('image/jpeg');
    expect(MIME_TYPES.webp).toBe('image/webp');
  });

  it('should have correct document MIME types', () => {
    expect(MIME_TYPES.docx).toContain('wordprocessingml');
    expect(MIME_TYPES.xlsx).toContain('spreadsheetml');
  });
});

describe('AI/RAG Constants', () => {
  it('should have valid chunk settings', () => {
    expect(DEFAULT_CHUNK_SIZE).toBeGreaterThan(0);
    expect(DEFAULT_CHUNK_OVERLAP).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CHUNK_OVERLAP).toBeLessThan(DEFAULT_CHUNK_SIZE);
  });

  it('should have valid retrieval settings', () => {
    expect(DEFAULT_TOP_K_CHUNKS).toBeGreaterThan(0);
    expect(DEFAULT_MIN_SIMILARITY).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_MIN_SIMILARITY).toBeLessThanOrEqual(1);
  });

  it('should have embedding model configured', () => {
    expect(DEFAULT_EMBEDDING_MODEL).toBeDefined();
    expect(typeof DEFAULT_EMBEDDING_MODEL).toBe('string');
  });

  it('should have valid embedding dimension', () => {
    expect(EMBEDDING_DIMENSION).toBeGreaterThan(0);
  });

  it('should have valid AI generation settings', () => {
    expect(DEFAULT_TEMPERATURE).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_TEMPERATURE).toBeLessThanOrEqual(2);
    expect(DEFAULT_MAX_TOKENS).toBeGreaterThan(0);
    expect(MAX_CONVERSATION_TOKENS).toBeGreaterThan(0);
  });
});

describe('IndexedDB Constants', () => {
  it('should have database name', () => {
    expect(INDEXEDDB_NAME).toBe('pdflover-db');
  });

  it('should have database version', () => {
    expect(INDEXEDDB_VERSION).toBeGreaterThan(0);
  });

  it('should have all required stores', () => {
    expect(INDEXEDDB_STORES.documents).toBeDefined();
    expect(INDEXEDDB_STORES.documentData).toBeDefined();
    expect(INDEXEDDB_STORES.conversations).toBeDefined();
    expect(INDEXEDDB_STORES.embeddings).toBeDefined();
    expect(INDEXEDDB_STORES.settings).toBeDefined();
    expect(INDEXEDDB_STORES.folders).toBeDefined();
  });
});

describe('Storage Keys', () => {
  it('should have theme key', () => {
    expect(STORAGE_KEYS.theme).toBeDefined();
  });

  it('should have locale key', () => {
    expect(STORAGE_KEYS.locale).toBeDefined();
  });

  it('should have preferences key', () => {
    expect(STORAGE_KEYS.preferences).toBeDefined();
  });

  it('should have aiProvider key', () => {
    expect(STORAGE_KEYS.aiProvider).toBeDefined();
  });
});

describe('Storage Quota', () => {
  it('should have warning threshold between 0 and 1', () => {
    expect(STORAGE_QUOTA_WARNING_THRESHOLD).toBeGreaterThan(0);
    expect(STORAGE_QUOTA_WARNING_THRESHOLD).toBeLessThanOrEqual(1);
  });
});

describe('Processing Timeout', () => {
  it('should have reasonable timeout value', () => {
    expect(PROCESSING_TIMEOUT).toBeGreaterThan(0);
    // 5 minutes in milliseconds
    expect(PROCESSING_TIMEOUT).toBe(5 * 60 * 1000);
  });
});

describe('OCR Languages', () => {
  it('should include English', () => {
    const english = OCR_LANGUAGES.find((lang) => lang.code === 'eng');
    expect(english).toBeDefined();
    expect(english?.name).toBe('English');
  });

  it('should have code and name for each language', () => {
    OCR_LANGUAGES.forEach((lang) => {
      expect(lang.code).toBeDefined();
      expect(lang.name).toBeDefined();
      expect(typeof lang.code).toBe('string');
      expect(typeof lang.name).toBe('string');
    });
  });

  it('should have valid default OCR language', () => {
    const defaultLang = OCR_LANGUAGES.find(
      (lang) => lang.code === DEFAULT_OCR_LANGUAGE
    );
    expect(defaultLang).toBeDefined();
  });
});

describe('Compression Settings', () => {
  it('should have all compression levels', () => {
    expect(COMPRESSION_SETTINGS.low).toBeDefined();
    expect(COMPRESSION_SETTINGS.medium).toBeDefined();
    expect(COMPRESSION_SETTINGS.high).toBeDefined();
    expect(COMPRESSION_SETTINGS.maximum).toBeDefined();
  });

  it('should have decreasing quality for higher compression', () => {
    expect(COMPRESSION_SETTINGS.low.imageQuality).toBeGreaterThan(
      COMPRESSION_SETTINGS.medium.imageQuality
    );
    expect(COMPRESSION_SETTINGS.medium.imageQuality).toBeGreaterThan(
      COMPRESSION_SETTINGS.high.imageQuality
    );
    expect(COMPRESSION_SETTINGS.high.imageQuality).toBeGreaterThan(
      COMPRESSION_SETTINGS.maximum.imageQuality
    );
  });

  it('should have decreasing DPI for higher compression', () => {
    expect(COMPRESSION_SETTINGS.low.maxImageDpi).toBeGreaterThan(
      COMPRESSION_SETTINGS.medium.maxImageDpi
    );
    expect(COMPRESSION_SETTINGS.medium.maxImageDpi).toBeGreaterThan(
      COMPRESSION_SETTINGS.high.maxImageDpi
    );
    expect(COMPRESSION_SETTINGS.high.maxImageDpi).toBeGreaterThan(
      COMPRESSION_SETTINGS.maximum.maxImageDpi
    );
  });
});

describe('API Rate Limits', () => {
  it('should have rate limits for providers', () => {
    expect(API_RATE_LIMITS.openrouter).toBeGreaterThan(0);
    expect(API_RATE_LIMITS.openai).toBeGreaterThan(0);
    expect(API_RATE_LIMITS.anthropic).toBeGreaterThan(0);
  });
});

describe('Worker Paths', () => {
  it('should have PDF worker path', () => {
    expect(WORKER_PATHS.pdfWorker).toBeDefined();
    expect(WORKER_PATHS.pdfWorker).toContain('.js');
  });

  it('should have OCR worker path', () => {
    expect(WORKER_PATHS.ocrWorker).toBeDefined();
  });

  it('should have AI worker path', () => {
    expect(WORKER_PATHS.aiWorker).toBeDefined();
  });
});

describe('Feature Flags', () => {
  it('should have all expected flags', () => {
    expect(typeof FEATURE_FLAGS.enableOCR).toBe('boolean');
    expect(typeof FEATURE_FLAGS.enableAI).toBe('boolean');
    expect(typeof FEATURE_FLAGS.enableCloudSync).toBe('boolean');
    expect(typeof FEATURE_FLAGS.enableOfficeConversion).toBe('boolean');
    expect(typeof FEATURE_FLAGS.enableWebGPU).toBe('boolean');
  });
});

describe('Error Messages', () => {
  it('should have message for INVALID_PDF', () => {
    expect(ERROR_MESSAGES.INVALID_PDF).toBeDefined();
    expect(typeof ERROR_MESSAGES.INVALID_PDF).toBe('string');
  });

  it('should have message for ENCRYPTED_PDF', () => {
    expect(ERROR_MESSAGES.ENCRYPTED_PDF).toBeDefined();
  });

  it('should have message for CORRUPTED_PDF', () => {
    expect(ERROR_MESSAGES.CORRUPTED_PDF).toBeDefined();
  });

  it('should have message for FILE_TOO_LARGE', () => {
    expect(ERROR_MESSAGES.FILE_TOO_LARGE).toBeDefined();
    // Should mention the max size
    expect(ERROR_MESSAGES.FILE_TOO_LARGE).toContain('100');
  });

  it('should have message for PAGE_OUT_OF_RANGE', () => {
    expect(ERROR_MESSAGES.PAGE_OUT_OF_RANGE).toBeDefined();
  });

  it('should have message for UNKNOWN_ERROR', () => {
    expect(ERROR_MESSAGES.UNKNOWN_ERROR).toBeDefined();
  });

  it('should have all error types defined', () => {
    const expectedErrors = [
      'INVALID_PDF',
      'ENCRYPTED_PDF',
      'CORRUPTED_PDF',
      'FILE_TOO_LARGE',
      'UNSUPPORTED_FORMAT',
      'PAGE_OUT_OF_RANGE',
      'INSUFFICIENT_MEMORY',
      'PROCESSING_TIMEOUT',
      'UNKNOWN_ERROR',
      'STORAGE_QUOTA_EXCEEDED',
      'NETWORK_ERROR',
      'AI_UNAVAILABLE',
    ];

    expectedErrors.forEach((error) => {
      expect(ERROR_MESSAGES).toHaveProperty(error);
    });
  });
});
