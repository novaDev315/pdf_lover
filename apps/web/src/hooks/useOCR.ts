/**
 * React hook for OCR (Optical Character Recognition) operations
 *
 * Provides a clean interface for performing OCR on images and PDFs
 * with progress tracking, caching, and automatic cleanup.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  initializeOCR,
  terminateOCR,
  recognizeText,
  ocrImages,
  getAvailableLanguages,
  estimateOCRTime,
} from '@pdflover/pdf-core';
import type {
  OCRLanguageCode,
  OCRResult,
  OCRPageResult,
  OCROptions,
} from '@pdflover/pdf-core';
import {
  renderAllPagesToImageData,
  getOptimalOCRScale,
  isScannedPDF,
} from '@/lib/pdf/pdf-renderer';
import { db } from '@/lib/storage/indexeddb';

/**
 * OCR processing state
 */
export type OCRState = 'idle' | 'initializing' | 'processing' | 'completed' | 'error';

/**
 * OCR progress information
 */
export interface OCRProgress {
  /** Current stage description */
  stage: string;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current page being processed */
  currentPage?: number;
  /** Total pages to process */
  totalPages?: number;
}

/**
 * Cached OCR result stored in IndexedDB
 */
interface CachedOCRResult {
  /** Document hash for cache lookup */
  documentHash: string;
  /** OCR result */
  result: OCRResult;
  /** Languages used */
  languages: string[];
  /** Timestamp when cached */
  cachedAt: Date;
}

/**
 * Options for the useOCR hook
 */
export interface UseOCROptions {
  /** Languages to use for OCR (default: ['eng']) */
  languages?: OCRLanguageCode[];
  /** Whether to cache results in IndexedDB */
  enableCache?: boolean;
  /** Scale factor for rendering pages (default: auto-calculated) */
  scale?: number;
  /** Callback when OCR completes */
  onComplete?: (result: OCRResult) => void;
  /** Callback when error occurs */
  onError?: (error: string) => void;
}

/**
 * Return type for the useOCR hook
 */
export interface UseOCRReturn {
  /** Current OCR state */
  state: OCRState;
  /** Progress information */
  progress: OCRProgress;
  /** OCR result (when completed) */
  result: OCRResult | null;
  /** Error message (when failed) */
  error: string | null;
  /** Selected languages */
  languages: OCRLanguageCode[];
  /** Set languages for OCR */
  setLanguages: (languages: OCRLanguageCode[]) => void;
  /** Run OCR on a single image */
  recognizeImage: (image: ImageData | HTMLCanvasElement | string) => Promise<OCRPageResult | null>;
  /** Run OCR on a PDF document */
  recognizePDF: (pdf: PDFDocumentProxy, documentId?: string) => Promise<OCRResult | null>;
  /** Run OCR on multiple images */
  recognizeImages: (images: Array<ImageData | HTMLCanvasElement | string>) => Promise<OCRResult | null>;
  /** Check if a PDF needs OCR (is scanned) */
  checkIfScanned: (pdf: PDFDocumentProxy) => Promise<boolean>;
  /** Cancel ongoing OCR operation */
  cancel: () => void;
  /** Reset state */
  reset: () => void;
  /** Get available language codes and names */
  availableLanguages: Record<string, string>;
  /** Estimate processing time */
  estimateTime: (pageCount: number, averagePageSize?: number) => number;
}

/**
 * Generate a simple hash for cache lookup
 */
function generateHash(data: ArrayBuffer): string {
  const arr = new Uint8Array(data);
  let hash = 0;
  for (let i = 0; i < arr.length; i++) {
    hash = ((hash << 5) - hash + arr[i]!) | 0;
  }
  return hash.toString(36);
}

/**
 * React hook for OCR operations
 *
 * Provides OCR functionality with progress tracking, caching, and cleanup.
 *
 * @param options - Hook options
 * @returns OCR state and control functions
 *
 * @example
 * ```tsx
 * function OCRComponent() {
 *   const {
 *     state,
 *     progress,
 *     result,
 *     recognizePDF,
 *     languages,
 *     setLanguages,
 *   } = useOCR({
 *     languages: ['eng'],
 *     onComplete: (result) => console.log('OCR complete:', result.fullText),
 *   });
 *
 *   const handleOCR = async () => {
 *     const result = await recognizePDF(pdfDocument);
 *     if (result) {
 *       console.log('Extracted text:', result.fullText);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleOCR} disabled={state === 'processing'}>
 *         Run OCR
 *       </button>
 *       {state === 'processing' && (
 *         <div>
 *           {progress.stage} - {progress.percentage}%
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useOCR(options: UseOCROptions = {}): UseOCRReturn {
  const {
    languages: initialLanguages = ['eng'],
    enableCache = true,
    scale: customScale,
    onComplete,
    onError,
  } = options;

  const [state, setState] = useState<OCRState>('idle');
  const [progress, setProgress] = useState<OCRProgress>({
    stage: '',
    percentage: 0,
  });
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [languages, setLanguages] = useState<OCRLanguageCode[]>(initialLanguages);

  const cancelledRef = useRef(false);
  const workerInitializedRef = useRef(false);

  /**
   * Initialize OCR worker
   */
  const initWorker = useCallback(async () => {
    if (!workerInitializedRef.current) {
      await initializeOCR(languages);
      workerInitializedRef.current = true;
    }
  }, [languages]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState('idle');
    setProgress({ stage: '', percentage: 0 });
    setResult(null);
    setError(null);
    cancelledRef.current = false;
  }, []);

  /**
   * Cancel ongoing operation
   */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setState('idle');
    setProgress({ stage: 'Cancelled', percentage: 0 });
  }, []);

  /**
   * Check cache for existing result
   */
  const checkCache = useCallback(async (documentId: string): Promise<OCRResult | null> => {
    if (!enableCache) return null;

    try {
      const cached = await db.getSetting<CachedOCRResult>(`ocr_cache_${documentId}`);
      if (cached && cached.languages.join(',') === languages.join(',')) {
        // Cache hit - check if not too old (7 days)
        const age = Date.now() - cached.cachedAt.getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000;
        if (age < maxAge) {
          return cached.result;
        }
      }
    } catch {
      // Cache miss or error
    }
    return null;
  }, [enableCache, languages]);

  /**
   * Save result to cache
   */
  const saveToCache = useCallback(async (documentId: string, ocrResult: OCRResult) => {
    if (!enableCache) return;

    try {
      const cached: CachedOCRResult = {
        documentHash: documentId,
        result: ocrResult,
        languages: languages as string[],
        cachedAt: new Date(),
      };
      await db.saveSetting(`ocr_cache_${documentId}`, cached);
    } catch {
      // Ignore cache errors
    }
  }, [enableCache, languages]);

  /**
   * Recognize text from a single image
   */
  const recognizeImage = useCallback(async (
    image: ImageData | HTMLCanvasElement | string
  ): Promise<OCRPageResult | null> => {
    if (cancelledRef.current) return null;

    try {
      setState('initializing');
      setProgress({ stage: 'Initializing OCR engine...', percentage: 0 });

      await initWorker();

      setState('processing');
      setProgress({ stage: 'Processing image...', percentage: 10 });

      const pageResult = await recognizeText(image, {
        languages,
        onProgress: (info) => {
          if (cancelledRef.current) return;
          setProgress({
            stage: info.stage,
            percentage: info.percentage,
          });
        },
      });

      if (cancelledRef.current) return null;

      setState('completed');
      setProgress({ stage: 'Complete', percentage: 100 });

      return pageResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OCR failed';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    }
  }, [languages, initWorker, onError]);

  /**
   * Recognize text from multiple images
   */
  const recognizeImages = useCallback(async (
    images: Array<ImageData | HTMLCanvasElement | string>
  ): Promise<OCRResult | null> => {
    if (cancelledRef.current) return null;

    try {
      setState('initializing');
      setProgress({ stage: 'Initializing OCR engine...', percentage: 0 });

      await initWorker();

      setState('processing');

      const ocrResult = await ocrImages(images, {
        languages,
        onProgress: (info) => {
          if (cancelledRef.current) return;
          setProgress({
            stage: info.stage,
            percentage: info.percentage,
            currentPage: info.currentItem,
            totalPages: info.totalItems,
          });
        },
      });

      if (cancelledRef.current) return null;

      setState('completed');
      setResult(ocrResult);
      setProgress({ stage: 'Complete', percentage: 100 });
      onComplete?.(ocrResult);

      return ocrResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OCR failed';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    }
  }, [languages, initWorker, onComplete, onError]);

  /**
   * Recognize text from a PDF document
   */
  const recognizePDF = useCallback(async (
    pdf: PDFDocumentProxy,
    documentId?: string
  ): Promise<OCRResult | null> => {
    if (cancelledRef.current) return null;

    try {
      // Check cache first
      if (documentId) {
        const cached = await checkCache(documentId);
        if (cached) {
          setResult(cached);
          setState('completed');
          setProgress({ stage: 'Loaded from cache', percentage: 100 });
          onComplete?.(cached);
          return cached;
        }
      }

      setState('initializing');
      setProgress({ stage: 'Preparing PDF pages...', percentage: 0 });

      // Get first page to calculate optimal scale
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1 });
      const scale = customScale ?? getOptimalOCRScale(viewport.width, viewport.height);

      // Render all pages to ImageData
      setProgress({ stage: 'Rendering pages...', percentage: 5 });

      const imageDataArray = await renderAllPagesToImageData(pdf, {
        scale,
        onProgress: (current, total) => {
          if (cancelledRef.current) return;
          setProgress({
            stage: `Rendering page ${current} of ${total}...`,
            percentage: 5 + (current / total) * 20,
            currentPage: current,
            totalPages: total,
          });
        },
      });

      if (cancelledRef.current) return null;

      // Initialize OCR
      setProgress({ stage: 'Initializing OCR engine...', percentage: 25 });
      await initWorker();

      // Run OCR
      setState('processing');

      const ocrResult = await ocrImages(imageDataArray, {
        languages,
        onProgress: (info) => {
          if (cancelledRef.current) return;
          setProgress({
            stage: info.stage,
            percentage: 25 + (info.percentage * 0.75),
            currentPage: info.currentItem,
            totalPages: info.totalItems,
          });
        },
      });

      if (cancelledRef.current) return null;

      // Cache the result
      if (documentId) {
        await saveToCache(documentId, ocrResult);
      }

      setState('completed');
      setResult(ocrResult);
      setProgress({ stage: 'Complete', percentage: 100 });
      onComplete?.(ocrResult);

      return ocrResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OCR failed';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    }
  }, [languages, customScale, initWorker, checkCache, saveToCache, onComplete, onError]);

  /**
   * Check if a PDF needs OCR
   */
  const checkIfScanned = useCallback(async (pdf: PDFDocumentProxy): Promise<boolean> => {
    return isScannedPDF(pdf);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Terminate worker on unmount if we initialized it
      if (workerInitializedRef.current) {
        terminateOCR().catch(() => {});
        workerInitializedRef.current = false;
      }
    };
  }, []);

  /**
   * Re-initialize worker when languages change
   */
  useEffect(() => {
    if (workerInitializedRef.current) {
      // Need to reinitialize with new languages
      workerInitializedRef.current = false;
      initializeOCR(languages).then(() => {
        workerInitializedRef.current = true;
      }).catch(() => {});
    }
  }, [languages]);

  return {
    state,
    progress,
    result,
    error,
    languages,
    setLanguages,
    recognizeImage,
    recognizePDF,
    recognizeImages,
    checkIfScanned,
    cancel,
    reset,
    availableLanguages: getAvailableLanguages(),
    estimateTime: estimateOCRTime,
  };
}

export default useOCR;
