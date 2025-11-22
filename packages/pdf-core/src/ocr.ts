/**
 * OCR operations using Tesseract.js for @pdflover/pdf-core
 *
 * Provides optical character recognition capabilities for scanned PDFs
 * and images. All processing runs in the browser using Web Workers.
 */

import type {
  ProgressCallback,
  ProcessingResult,
} from '@pdflover/shared';
import {
  createProgressReporter,
  measureTime,
} from './utils.js';

/**
 * Supported OCR languages with their Tesseract language codes
 */
export const OCR_LANGUAGES = {
  eng: 'English',
  spa: 'Spanish',
  fra: 'French',
  deu: 'German',
  ita: 'Italian',
  por: 'Portuguese',
  nld: 'Dutch',
  pol: 'Polish',
  rus: 'Russian',
  jpn: 'Japanese',
  chi_sim: 'Chinese (Simplified)',
  chi_tra: 'Chinese (Traditional)',
  kor: 'Korean',
  ara: 'Arabic',
  hin: 'Hindi',
} as const;

export type OCRLanguageCode = keyof typeof OCR_LANGUAGES;

/**
 * Bounding box for recognized text
 */
export interface TextBoundingBox {
  /** X coordinate (top-left) */
  x: number;
  /** Y coordinate (top-left) */
  y: number;
  /** Width of the bounding box */
  width: number;
  /** Height of the bounding box */
  height: number;
}

/**
 * Recognized word with position and confidence
 */
export interface RecognizedWord {
  /** The recognized text */
  text: string;
  /** Confidence score (0-100) */
  confidence: number;
  /** Bounding box coordinates */
  bbox: TextBoundingBox;
  /** Baseline position */
  baseline: number;
}

/**
 * Recognized line of text
 */
export interface RecognizedLine {
  /** The full line text */
  text: string;
  /** Words in this line */
  words: RecognizedWord[];
  /** Confidence score (0-100) */
  confidence: number;
  /** Bounding box coordinates */
  bbox: TextBoundingBox;
}

/**
 * Recognized paragraph
 */
export interface RecognizedParagraph {
  /** The full paragraph text */
  text: string;
  /** Lines in this paragraph */
  lines: RecognizedLine[];
  /** Confidence score (0-100) */
  confidence: number;
  /** Bounding box coordinates */
  bbox: TextBoundingBox;
}

/**
 * Recognized block of text
 */
export interface RecognizedBlock {
  /** The full block text */
  text: string;
  /** Paragraphs in this block */
  paragraphs: RecognizedParagraph[];
  /** Confidence score (0-100) */
  confidence: number;
  /** Bounding box coordinates */
  bbox: TextBoundingBox;
}

/**
 * OCR result for a single page
 */
export interface OCRPageResult {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Full extracted text */
  text: string;
  /** Overall confidence score (0-100) */
  confidence: number;
  /** Recognized text blocks with positions */
  blocks: RecognizedBlock[];
  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * Complete OCR result for a document
 */
export interface OCRResult {
  /** Results for each page */
  pages: OCRPageResult[];
  /** Combined text from all pages */
  fullText: string;
  /** Average confidence score */
  averageConfidence: number;
  /** Languages used for recognition */
  languages: string[];
  /** Total processing time in milliseconds */
  totalTime: number;
}

/**
 * Options for OCR operations
 */
export interface OCROptions {
  /** Languages to use for recognition (default: ['eng']) */
  languages?: OCRLanguageCode[];
  /** Progress callback */
  onProgress?: ProgressCallback;
  /** Page Segmentation Mode (PSM) - default is automatic */
  pageSegMode?: number;
  /** OCR Engine Mode (OEM) - default is LSTM */
  ocrEngineMode?: number;
  /** Whether to preserve whitespace in output */
  preserveWhitespace?: boolean;
}

/**
 * Options for creating searchable PDF
 */
export interface SearchablePDFOptions extends OCROptions {
  /** Whether to replace existing text layers */
  replaceExisting?: boolean;
  /** Font to use for invisible text layer */
  fontName?: string;
  /** Font size multiplier for text layer */
  fontSizeMultiplier?: number;
}

/**
 * Tesseract worker instance type
 */
interface TesseractWorker {
  loadLanguage: (lang: string) => Promise<void>;
  initialize: (lang: string) => Promise<void>;
  recognize: (image: ImageData | HTMLCanvasElement | string, options?: Record<string, unknown>) => Promise<TesseractResult>;
  terminate: () => Promise<void>;
  setParameters: (params: Record<string, string | number>) => Promise<void>;
}

/**
 * Tesseract recognition result
 */
interface TesseractResult {
  data: {
    text: string;
    confidence: number;
    blocks: TesseractBlock[];
    paragraphs: TesseractParagraph[];
    lines: TesseractLine[];
    words: TesseractWord[];
  };
}

interface TesseractWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  baseline: { x0: number; y0: number; x1: number; y1: number };
}

interface TesseractLine {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words: TesseractWord[];
}

interface TesseractParagraph {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  lines: TesseractLine[];
}

interface TesseractBlock {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  paragraphs: TesseractParagraph[];
}

/**
 * Global worker instance (singleton pattern)
 */
let globalWorker: TesseractWorker | null = null;
let initializedLanguages: Set<string> = new Set();

/**
 * Initialize the OCR worker with specified language(s)
 *
 * @param languages - Array of language codes to load
 * @returns Initialized Tesseract worker
 *
 * @example
 * ```typescript
 * const worker = await initializeOCR(['eng', 'spa']);
 * ```
 */
export async function initializeOCR(
  languages: OCRLanguageCode[] = ['eng']
): Promise<TesseractWorker> {
  // Dynamically import Tesseract.js
  const Tesseract = await import('tesseract.js');

  if (!globalWorker) {
    globalWorker = await Tesseract.createWorker({
      logger: () => {}, // Silent logging
    });
  }

  // Load any new languages that haven't been initialized
  const newLanguages = languages.filter((lang) => !initializedLanguages.has(lang));

  if (newLanguages.length > 0) {
    for (const lang of newLanguages) {
      await globalWorker.loadLanguage(lang);
      initializedLanguages.add(lang);
    }

    // Initialize with all loaded languages
    const allLanguages = Array.from(initializedLanguages).join('+');
    await globalWorker.initialize(allLanguages);
  }

  return globalWorker;
}

/**
 * Terminate the OCR worker and free resources
 *
 * Should be called when OCR operations are complete to free memory.
 *
 * @example
 * ```typescript
 * await terminateOCR();
 * ```
 */
export async function terminateOCR(): Promise<void> {
  if (globalWorker) {
    await globalWorker.terminate();
    globalWorker = null;
    initializedLanguages.clear();
  }
}

/**
 * Convert Tesseract bounding box to our format
 */
function convertBBox(bbox: { x0: number; y0: number; x1: number; y1: number }): TextBoundingBox {
  return {
    x: bbox.x0,
    y: bbox.y0,
    width: bbox.x1 - bbox.x0,
    height: bbox.y1 - bbox.y0,
  };
}

/**
 * Convert Tesseract word to our format
 */
function convertWord(word: TesseractWord): RecognizedWord {
  return {
    text: word.text,
    confidence: word.confidence,
    bbox: convertBBox(word.bbox),
    baseline: word.baseline?.y0 ?? word.bbox.y1,
  };
}

/**
 * Convert Tesseract line to our format
 */
function convertLine(line: TesseractLine): RecognizedLine {
  return {
    text: line.text,
    confidence: line.confidence,
    bbox: convertBBox(line.bbox),
    words: line.words.map(convertWord),
  };
}

/**
 * Convert Tesseract paragraph to our format
 */
function convertParagraph(para: TesseractParagraph): RecognizedParagraph {
  return {
    text: para.text,
    confidence: para.confidence,
    bbox: convertBBox(para.bbox),
    lines: para.lines.map(convertLine),
  };
}

/**
 * Convert Tesseract block to our format
 */
function convertBlock(block: TesseractBlock): RecognizedBlock {
  return {
    text: block.text,
    confidence: block.confidence,
    bbox: convertBBox(block.bbox),
    paragraphs: block.paragraphs.map(convertParagraph),
  };
}

/**
 * Recognize text from an image
 *
 * Performs OCR on a single image and returns extracted text with
 * position information.
 *
 * @param imageData - Image data (ImageData, canvas, or data URL)
 * @param options - OCR options
 * @returns OCR result with text and positions
 *
 * @example
 * ```typescript
 * const result = await recognizeText(canvas, {
 *   languages: ['eng', 'fra'],
 * });
 * console.log(result.text);
 * ```
 */
export async function recognizeText(
  imageData: ImageData | HTMLCanvasElement | string,
  options: OCROptions = {}
): Promise<OCRPageResult> {
  const { languages = ['eng'], onProgress, pageSegMode, ocrEngineMode } = options;

  const start = performance.now();

  // Initialize worker with required languages
  const worker = await initializeOCR(languages);

  // Set parameters if specified
  if (pageSegMode !== undefined || ocrEngineMode !== undefined) {
    const params: Record<string, string | number> = {};
    if (pageSegMode !== undefined) params['tessedit_pageseg_mode'] = pageSegMode;
    if (ocrEngineMode !== undefined) params['tessedit_ocr_engine_mode'] = ocrEngineMode;
    await worker.setParameters(params);
  }

  // Report progress
  onProgress?.({
    percentage: 10,
    stage: 'Recognizing text...',
  });

  // Perform recognition
  const result = await worker.recognize(imageData);

  onProgress?.({
    percentage: 90,
    stage: 'Processing results...',
  });

  const processingTime = Math.round(performance.now() - start);

  // Convert result to our format
  const ocrResult: OCRPageResult = {
    pageNumber: 1,
    text: result.data.text,
    confidence: result.data.confidence,
    blocks: result.data.blocks?.map(convertBlock) ?? [],
    processingTime,
  };

  onProgress?.({
    percentage: 100,
    stage: 'Complete',
  });

  return ocrResult;
}

/**
 * Perform OCR on multiple images (e.g., PDF pages rendered as images)
 *
 * @param images - Array of image data
 * @param options - OCR options
 * @returns Complete OCR result for all pages
 *
 * @example
 * ```typescript
 * const images = await renderPDFToImages(pdfDocument);
 * const result = await ocrImages(images, {
 *   languages: ['eng'],
 *   onProgress: (info) => console.log(info.percentage),
 * });
 * ```
 */
export async function ocrImages(
  images: Array<ImageData | HTMLCanvasElement | string>,
  options: OCROptions = {}
): Promise<OCRResult> {
  const { languages = ['eng'], onProgress } = options;

  const stages = ['Initializing', 'Processing pages', 'Finalizing'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    reportProgress(0, 0);

    // Initialize worker
    await initializeOCR(languages);

    reportProgress(0, 100);
    reportProgress(1, 0);

    const pageResults: OCRPageResult[] = [];
    let totalConfidence = 0;

    for (let i = 0; i < images.length; i++) {
      const pageResult = await recognizeText(images[i]!, {
        languages,
        pageSegMode: options.pageSegMode,
        ocrEngineMode: options.ocrEngineMode,
        preserveWhitespace: options.preserveWhitespace,
      });

      pageResult.pageNumber = i + 1;
      pageResults.push(pageResult);
      totalConfidence += pageResult.confidence;

      reportProgress(1, ((i + 1) / images.length) * 100, i + 1, images.length);
    }

    reportProgress(2, 50);

    // Combine all text
    const fullText = pageResults.map((p) => p.text).join('\n\n--- Page Break ---\n\n');
    const averageConfidence = pageResults.length > 0 ? totalConfidence / pageResults.length : 0;

    reportProgress(2, 100);

    return {
      pages: pageResults,
      fullText,
      averageConfidence,
      languages: languages as string[],
      totalTime: 0, // Will be set by measureTime
    };
  });

  return { ...result, totalTime: duration };
}

/**
 * OCR a PDF document by rendering pages to images first
 *
 * This function expects pre-rendered page images. Use with pdf-renderer.ts
 * in the web app for full PDF OCR capability.
 *
 * @param pageImages - Array of rendered page images
 * @param options - OCR options
 * @returns Processing result with OCR data
 *
 * @example
 * ```typescript
 * // In web app context:
 * const pageImages = await renderAllPages(pdfDocument, { scale: 2 });
 * const result = await ocrPDF(pageImages, { languages: ['eng'] });
 * ```
 */
export async function ocrPDF(
  pageImages: Array<ImageData | HTMLCanvasElement | string>,
  options: OCROptions = {}
): Promise<ProcessingResult<OCRResult>> {
  const { onProgress } = options;

  try {
    const ocrResult = await ocrImages(pageImages, options);

    return {
      success: true,
      data: ocrResult,
      duration: ocrResult.totalTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'OCR processing failed';

    onProgress?.({
      percentage: 0,
      stage: 'Error',
    });

    return {
      success: false,
      error: errorMessage,
      errorCode: 'UNKNOWN_ERROR',
      duration: 0,
    };
  }
}

/**
 * Create a searchable PDF by adding an invisible text layer
 *
 * Note: This function creates OCR data that can be used to add a text layer.
 * The actual PDF modification should be done using pdf-lib in the calling code.
 *
 * @param pageImages - Array of rendered page images
 * @param options - Options for searchable PDF creation
 * @returns OCR result with position data for text layer creation
 *
 * @example
 * ```typescript
 * const ocrData = await createSearchablePDFData(pageImages, {
 *   languages: ['eng'],
 * });
 *
 * // Use ocrData.pages[].blocks to position invisible text
 * ```
 */
export async function createSearchablePDFData(
  pageImages: Array<ImageData | HTMLCanvasElement | string>,
  options: SearchablePDFOptions = {}
): Promise<ProcessingResult<OCRResult>> {
  return ocrPDF(pageImages, options);
}

/**
 * Get available OCR languages
 *
 * @returns Object mapping language codes to display names
 */
export function getAvailableLanguages(): Record<string, string> {
  return { ...OCR_LANGUAGES };
}

/**
 * Check if a language code is valid
 *
 * @param code - Language code to check
 * @returns Whether the code is valid
 */
export function isValidLanguageCode(code: string): code is OCRLanguageCode {
  return code in OCR_LANGUAGES;
}

/**
 * Estimate OCR processing time based on image count and size
 *
 * @param imageCount - Number of images to process
 * @param averageSize - Average image size in pixels (width * height)
 * @returns Estimated time in milliseconds
 */
export function estimateOCRTime(imageCount: number, averageSize: number = 1000000): number {
  // Rough estimate: ~1.5 seconds per megapixel
  const timePerImage = (averageSize / 1000000) * 1500;
  return Math.round(imageCount * timePerImage);
}
