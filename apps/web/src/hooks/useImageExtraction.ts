/**
 * React hook for PDF image extraction operations
 *
 * Provides a clean interface for extracting images from PDFs
 * with progress tracking, caching, and state management.
 */

import { useState, useCallback, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  extractImages,
  extractImagesAsBlobs,
  getImageCount,
  extractImageMetadata,
  createImageFilename,
} from '@pdflover/pdf-core';
import type {
  ExtractedImage,
  ImageMetadata,
  ExtractImagesOptions,
  ExtractImagesResult,
  ImageCountResult,
} from '@pdflover/pdf-core';
import { db } from '@/lib/storage/indexeddb';

/**
 * Extraction state
 */
export type ExtractionState = 'idle' | 'counting' | 'extracting' | 'completed' | 'error';

/**
 * Extraction progress information
 */
export interface ExtractionProgress {
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
 * Cached extraction result
 */
interface CachedExtractionResult {
  /** Document ID */
  documentId: string;
  /** Extracted images */
  images: ExtractedImage[];
  /** Options used */
  options: string;
  /** Timestamp */
  cachedAt: Date;
}

/**
 * Options for the useImageExtraction hook
 */
export interface UseImageExtractionOptions {
  /** Enable caching of results */
  enableCache?: boolean;
  /** Callback when extraction completes */
  onComplete?: (images: ExtractedImage[]) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * Return type for the useImageExtraction hook
 */
export interface UseImageExtractionReturn {
  /** Current extraction state */
  state: ExtractionState;
  /** Progress information */
  progress: ExtractionProgress;
  /** Extracted images */
  images: ExtractedImage[];
  /** Image metadata (when using scanImages) */
  metadata: ImageMetadata[];
  /** Image count result */
  imageCount: ImageCountResult | null;
  /** Error message */
  error: string | null;
  /** Extract images from PDF */
  extractFromPdf: (pdf: PDFDocumentProxy, options?: ExtractImagesOptions) => Promise<ExtractedImage[]>;
  /** Extract images as blobs */
  extractAsBlobs: (pdf: PDFDocumentProxy, options?: ExtractImagesOptions) => Promise<{ blob: Blob; metadata: Omit<ExtractedImage, 'data'> }[]>;
  /** Count images without extracting */
  countImages: (pdf: PDFDocumentProxy) => Promise<ImageCountResult>;
  /** Scan for image metadata without extracting data */
  scanImages: (pdf: PDFDocumentProxy, options?: Pick<ExtractImagesOptions, 'pages' | 'minWidth' | 'minHeight'>) => Promise<ImageMetadata[]>;
  /** Get a single image by index */
  getImage: (index: number) => ExtractedImage | undefined;
  /** Get images by page */
  getImagesByPage: (page: number) => ExtractedImage[];
  /** Create filename for image */
  createFilename: (image: ExtractedImage | ImageMetadata, prefix?: string) => string;
  /** Cancel ongoing operation */
  cancel: () => void;
  /** Reset state */
  reset: () => void;
  /** Clear cached images */
  clearCache: () => void;
}

/**
 * Generate cache key from options
 */
function generateCacheKey(documentId: string, options: ExtractImagesOptions): string {
  const optString = JSON.stringify({
    pages: options.pages,
    minWidth: options.minWidth,
    minHeight: options.minHeight,
    outputFormat: options.outputFormat,
    quality: options.quality,
  });
  return `img_extract_${documentId}_${optString}`;
}

/**
 * React hook for image extraction from PDFs
 *
 * @param options - Hook options
 * @returns Extraction state and control functions
 *
 * @example
 * ```tsx
 * function ImageExtractor() {
 *   const {
 *     state,
 *     progress,
 *     images,
 *     extractFromPdf,
 *     countImages,
 *   } = useImageExtraction({
 *     onComplete: (images) => console.log(`Extracted ${images.length} images`),
 *   });
 *
 *   const handleExtract = async () => {
 *     const pdfDoc = await loadPdf(file);
 *     await extractFromPdf(pdfDoc, { minWidth: 100 });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleExtract} disabled={state === 'extracting'}>
 *         Extract Images
 *       </button>
 *       {state === 'extracting' && (
 *         <div>{progress.stage} - {progress.percentage}%</div>
 *       )}
 *       <div className="grid">
 *         {images.map((img, i) => (
 *           <img key={i} src={URL.createObjectURL(new Blob([img.data]))} />
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useImageExtraction(options: UseImageExtractionOptions = {}): UseImageExtractionReturn {
  const { enableCache = false, onComplete, onError } = options;

  const [state, setState] = useState<ExtractionState>('idle');
  const [progress, setProgress] = useState<ExtractionProgress>({
    stage: '',
    percentage: 0,
  });
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [metadata, setMetadata] = useState<ImageMetadata[]>([]);
  const [imageCount, setImageCount] = useState<ImageCountResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancelledRef = useRef(false);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState('idle');
    setProgress({ stage: '', percentage: 0 });
    setImages([]);
    setMetadata([]);
    setImageCount(null);
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
   * Clear cached images from memory
   */
  const clearCache = useCallback(() => {
    setImages([]);
    setMetadata([]);
  }, []);

  /**
   * Check cache for existing result
   */
  const checkCache = useCallback(async (
    documentId: string,
    extractOptions: ExtractImagesOptions
  ): Promise<ExtractedImage[] | null> => {
    if (!enableCache) return null;

    try {
      const cacheKey = generateCacheKey(documentId, extractOptions);
      const cached = await db.getSetting<CachedExtractionResult>(cacheKey);

      if (cached) {
        // Check if not too old (1 hour)
        const age = Date.now() - cached.cachedAt.getTime();
        const maxAge = 60 * 60 * 1000;
        if (age < maxAge) {
          return cached.images;
        }
      }
    } catch {
      // Cache miss
    }
    return null;
  }, [enableCache]);

  /**
   * Save result to cache
   */
  const saveToCache = useCallback(async (
    documentId: string,
    extractOptions: ExtractImagesOptions,
    extractedImages: ExtractedImage[]
  ) => {
    if (!enableCache) return;

    try {
      const cacheKey = generateCacheKey(documentId, extractOptions);
      const cached: CachedExtractionResult = {
        documentId,
        images: extractedImages,
        options: JSON.stringify(extractOptions),
        cachedAt: new Date(),
      };
      await db.saveSetting(cacheKey, cached);
    } catch {
      // Ignore cache errors
    }
  }, [enableCache]);

  /**
   * Extract images from PDF
   */
  const extractFromPdf = useCallback(async (
    pdf: PDFDocumentProxy,
    extractOptions: ExtractImagesOptions = {}
  ): Promise<ExtractedImage[]> => {
    if (cancelledRef.current) return [];

    // Generate document ID for caching
    const documentId = `pdf_${pdf.fingerprints[0] || Date.now()}`;

    // Check cache
    const cached = await checkCache(documentId, extractOptions);
    if (cached) {
      setImages(cached);
      setState('completed');
      setProgress({ stage: 'Loaded from cache', percentage: 100 });
      onComplete?.(cached);
      return cached;
    }

    try {
      setState('extracting');
      setError(null);
      cancelledRef.current = false;

      const result = await extractImages(pdf, {
        ...extractOptions,
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

      if (cancelledRef.current) return [];

      if (result.success) {
        setImages(result.images);
        setState('completed');
        setProgress({ stage: 'Complete', percentage: 100 });

        // Save to cache
        await saveToCache(documentId, extractOptions, result.images);

        onComplete?.(result.images);
        return result.images;
      } else {
        throw new Error(result.error ?? 'Failed to extract images');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Extraction failed';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return [];
    }
  }, [checkCache, saveToCache, onComplete, onError]);

  /**
   * Extract images as blobs
   */
  const extractAsBlobs = useCallback(async (
    pdf: PDFDocumentProxy,
    extractOptions: ExtractImagesOptions = {}
  ): Promise<{ blob: Blob; metadata: Omit<ExtractedImage, 'data'> }[]> => {
    if (cancelledRef.current) return [];

    try {
      setState('extracting');
      setError(null);

      const blobs = await extractImagesAsBlobs(pdf, {
        ...extractOptions,
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

      if (cancelledRef.current) return [];

      setState('completed');
      setProgress({ stage: 'Complete', percentage: 100 });

      return blobs;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Extraction failed';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return [];
    }
  }, [onError]);

  /**
   * Count images without extracting
   */
  const countImages = useCallback(async (pdf: PDFDocumentProxy): Promise<ImageCountResult> => {
    if (cancelledRef.current) return { total: 0, perPage: [] };

    try {
      setState('counting');
      setError(null);
      setProgress({ stage: 'Counting images...', percentage: 0 });

      const count = await getImageCount(pdf);

      if (cancelledRef.current) return { total: 0, perPage: [] };

      setImageCount(count);
      setState('completed');
      setProgress({ stage: 'Complete', percentage: 100 });

      return count;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to count images';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return { total: 0, perPage: [] };
    }
  }, [onError]);

  /**
   * Scan for image metadata
   */
  const scanImages = useCallback(async (
    pdf: PDFDocumentProxy,
    scanOptions: Pick<ExtractImagesOptions, 'pages' | 'minWidth' | 'minHeight'> = {}
  ): Promise<ImageMetadata[]> => {
    if (cancelledRef.current) return [];

    try {
      setState('counting');
      setError(null);

      const meta = await extractImageMetadata(pdf, {
        ...scanOptions,
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

      if (cancelledRef.current) return [];

      setMetadata(meta);
      setState('completed');
      setProgress({ stage: 'Complete', percentage: 100 });

      return meta;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to scan images';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return [];
    }
  }, [onError]);

  /**
   * Get a single image by index
   */
  const getImage = useCallback((index: number): ExtractedImage | undefined => {
    return images[index];
  }, [images]);

  /**
   * Get images by page number
   */
  const getImagesByPage = useCallback((page: number): ExtractedImage[] => {
    return images.filter((img) => img.page === page);
  }, [images]);

  /**
   * Create filename for image
   */
  const createFilename = useCallback((
    image: ExtractedImage | ImageMetadata,
    prefix = 'image'
  ): string => {
    return createImageFilename(image, prefix);
  }, []);

  return {
    state,
    progress,
    images,
    metadata,
    imageCount,
    error,
    extractFromPdf,
    extractAsBlobs,
    countImages,
    scanImages,
    getImage,
    getImagesByPage,
    createFilename,
    cancel,
    reset,
    clearCache,
  };
}

export default useImageExtraction;
