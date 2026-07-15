/**
 * React hook for PDF comparison operations
 *
 * Provides a clean interface for comparing PDFs with progress tracking,
 * result caching, and automatic cleanup.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { db } from '@/lib/storage/indexeddb';
import {
  arePDFsIdentical as arePDFsIdenticalCore,
  comparePDFs as comparePDFsCore,
  compareText as compareTextCore,
  compareVisual as compareVisualCore,
} from '@pdflover/pdf-core';

/**
 * Comparison processing state
 */
export type ComparisonState = 'idle' | 'loading' | 'comparing' | 'completed' | 'error';

/**
 * Comparison mode options
 */
export type ComparisonMode = 'text' | 'visual' | 'both';

/**
 * Progress information during comparison
 */
export interface ComparisonProgress {
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
 * Types for comparison results
 */
export type DifferenceType = 'text' | 'image' | 'layout' | 'addition' | 'deletion' | 'modification';

export interface Difference {
  type: DifferenceType;
  pageNumber: number;
  location: { x: number; y: number; width: number; height: number };
  oldValue: string | null;
  newValue: string | null;
  description?: string;
}

export interface LineDiff {
  originalLine: number | null;
  modifiedLine: number | null;
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  originalText?: string;
  modifiedText?: string;
  pageNumber: number;
}

export interface PageComparison {
  pageNum: number;
  differences: Difference[];
  similarity: number;
  textSimilarity: number;
  visualSimilarity?: number;
  sameDimensions: boolean;
  diffImageDataUrl?: string;
}

export interface ComparisonSummary {
  pdf1PageCount: number;
  pdf2PageCount: number;
  pagesChanged: number;
  pagesIdentical: number;
  textChanges: number;
  textAdditions: number;
  textDeletions: number;
  textModifications: number;
  overallSimilarity: number;
  visualSimilarity?: number;
  duration: number;
}

export interface ComparisonResult {
  pages: PageComparison[];
  summary: ComparisonSummary;
  textDiff?: LineDiff[];
}

export interface TextComparisonResult {
  lineDiffs: LineDiff[];
  similarity: number;
  additions: number;
  deletions: number;
  modifications: number;
}

export interface VisualPageDiff {
  pageNum: number;
  diffImageDataUrl: string;
  similarity: number;
  differentPixels: number;
  totalPixels: number;
}

export interface CompareOptions {
  compareText?: boolean;
  compareVisual?: boolean;
  visualThreshold?: number;
  scale?: number;
  onProgress?: (info: ComparisonProgress) => void;
}

/**
 * Cached comparison result
 */
interface CachedComparisonResult {
  key: string;
  result: ComparisonResult;
  mode: ComparisonMode;
  cachedAt: Date;
}

/**
 * Options for the usePdfComparison hook
 */
export interface UsePdfComparisonOptions {
  defaultMode?: ComparisonMode;
  enableCache?: boolean;
  visualThreshold?: number;
  scale?: number;
  onComplete?: (result: ComparisonResult) => void;
  onError?: (error: string) => void;
}

/**
 * Return type for the usePdfComparison hook
 */
export interface UsePdfComparisonReturn {
  state: ComparisonState;
  progress: ComparisonProgress;
  result: ComparisonResult | null;
  error: string | null;
  mode: ComparisonMode;
  setMode: (mode: ComparisonMode) => void;
  compare: (pdf1: ArrayBuffer | File, pdf2: ArrayBuffer | File) => Promise<ComparisonResult | null>;
  compareTextOnly: (pdf1: ArrayBuffer | File, pdf2: ArrayBuffer | File) => Promise<TextComparisonResult | null>;
  compareVisually: (pdf1: ArrayBuffer | File, pdf2: ArrayBuffer | File) => Promise<VisualPageDiff[] | null>;
  checkIdentical: (pdf1: ArrayBuffer | File, pdf2: ArrayBuffer | File) => Promise<boolean>;
  getReport: () => string | null;
  getPageDifferences: (pageNum: number) => PageComparison | null;
  getTextDiff: () => LineDiff[] | null;
  nextDifference: () => number | null;
  prevDifference: () => number | null;
  currentDifferenceIndex: number;
  totalDifferences: number;
  cancel: () => void;
  reset: () => void;
}

/**
 * Convert File to ArrayBuffer
 */
async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

/**
 * Generate cache key from two PDF buffers
 */
function generateCacheKey(pdf1: ArrayBuffer, pdf2: ArrayBuffer): string {
  const arr1 = new Uint8Array(pdf1.slice(0, 1000));
  const arr2 = new Uint8Array(pdf2.slice(0, 1000));

  let hash1 = 0;
  let hash2 = 0;

  for (let i = 0; i < arr1.length; i++) {
    hash1 = ((hash1 << 5) - hash1 + arr1[i]!) | 0;
  }
  for (let i = 0; i < arr2.length; i++) {
    hash2 = ((hash2 << 5) - hash2 + arr2[i]!) | 0;
  }

  return `${hash1.toString(36)}_${hash2.toString(36)}_${pdf1.byteLength}_${pdf2.byteLength}`;
}

/**
 * Generate a human-readable diff report
 */
function generateDiffReport(result: ComparisonResult): string {
  const { summary, pages } = result;
  const lines: string[] = [];

  lines.push('PDF Comparison Report');
  lines.push('=====================');
  lines.push('');
  lines.push('Summary');
  lines.push('-------');
  lines.push(`PDF 1 Pages: ${summary.pdf1PageCount}`);
  lines.push(`PDF 2 Pages: ${summary.pdf2PageCount}`);
  lines.push(`Overall Similarity: ${summary.overallSimilarity}%`);
  lines.push('');
  lines.push(`Pages Changed: ${summary.pagesChanged}`);
  lines.push(`Pages Identical: ${summary.pagesIdentical}`);
  lines.push('');

  if (summary.textChanges > 0) {
    lines.push('Text Changes');
    lines.push('------------');
    lines.push(`Additions: ${summary.textAdditions}`);
    lines.push(`Deletions: ${summary.textDeletions}`);
    lines.push(`Modifications: ${summary.textModifications}`);
    lines.push('');
  }

  lines.push('Page Details');
  lines.push('------------');
  for (const page of pages) {
    if (page.differences.length > 0) {
      lines.push(`\nPage ${page.pageNum} (${page.similarity}% similar):`);
      for (const diff of page.differences) {
        const typeLabel = diff.type.charAt(0).toUpperCase() + diff.type.slice(1);
        lines.push(`  - ${typeLabel}: ${diff.description || diff.newValue || diff.oldValue}`);
      }
    }
  }

  lines.push('');
  lines.push(`Comparison completed in ${summary.duration}ms`);

  return lines.join('\n');
}

/**
 * React hook for PDF comparison operations
 */
export function usePdfComparison(options: UsePdfComparisonOptions = {}): UsePdfComparisonReturn {
  const {
    defaultMode = 'text',
    enableCache = true,
    visualThreshold = 0.1,
    scale = 1.5,
    onComplete,
    onError,
  } = options;

  const [state, setState] = useState<ComparisonState>('idle');
  const [progress, setProgress] = useState<ComparisonProgress>({
    stage: '',
    percentage: 0,
  });
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ComparisonMode>(defaultMode);
  const [currentDifferenceIndex, setCurrentDifferenceIndex] = useState(0);

  const cancelledRef = useRef(false);

  const totalDifferences = useMemo(() => {
    if (!result) return 0;
    return result.pages.reduce((sum, page) => sum + page.differences.length, 0);
  }, [result]);

  const reset = useCallback(() => {
    setState('idle');
    setProgress({ stage: '', percentage: 0 });
    setResult(null);
    setError(null);
    setCurrentDifferenceIndex(0);
    cancelledRef.current = false;
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setState('idle');
    setProgress({ stage: 'Cancelled', percentage: 0 });
  }, []);

  const checkCache = useCallback(async (
    cacheKey: string,
    requestedMode: ComparisonMode
  ): Promise<ComparisonResult | null> => {
    if (!enableCache) return null;

    try {
      const cached = await db.getSetting<CachedComparisonResult>(`compare_cache_${cacheKey}`);
      if (cached && cached.mode === requestedMode) {
        const age = Date.now() - new Date(cached.cachedAt).getTime();
        const maxAge = 60 * 60 * 1000;
        if (age < maxAge) {
          return cached.result;
        }
      }
    } catch {
      // Cache miss or error
    }
    return null;
  }, [enableCache]);

  const saveToCache = useCallback(async (
    cacheKey: string,
    comparisonResult: ComparisonResult,
    comparisonMode: ComparisonMode
  ) => {
    if (!enableCache) return;

    try {
      const cached: CachedComparisonResult = {
        key: cacheKey,
        result: comparisonResult,
        mode: comparisonMode,
        cachedAt: new Date(),
      };
      await db.saveSetting(`compare_cache_${cacheKey}`, cached);
    } catch {
      // Ignore cache errors
    }
  }, [enableCache]);

  const getPdfData = useCallback(async (pdf: ArrayBuffer | File): Promise<ArrayBuffer> => {
    if (pdf instanceof File) {
      return fileToArrayBuffer(pdf);
    }
    return pdf;
  }, []);

  const compare = useCallback(async (
    pdf1: ArrayBuffer | File,
    pdf2: ArrayBuffer | File
  ): Promise<ComparisonResult | null> => {
    if (cancelledRef.current) return null;

    try {
      setState('loading');
      setProgress({ stage: 'Loading PDFs...', percentage: 0 });
      setError(null);

      const data1 = await getPdfData(pdf1);
      const data2 = await getPdfData(pdf2);

      if (cancelledRef.current) return null;

      const cacheKey = generateCacheKey(data1, data2);

      const cached = await checkCache(cacheKey, mode);
      if (cached) {
        setResult(cached);
        setState('completed');
        setProgress({ stage: 'Loaded from cache', percentage: 100 });
        onComplete?.(cached);
        return cached;
      }

      setState('comparing');

      const comparisonResult = await comparePDFsCore(data1, data2, {
        compareText: mode === 'text' || mode === 'both',
        compareVisual: mode === 'visual' || mode === 'both',
        visualThreshold,
        scale,
        onProgress: (info) => {
          if (cancelledRef.current) return;
          setProgress(info);
        },
      });

      if (cancelledRef.current) return null;

      await saveToCache(cacheKey, comparisonResult, mode);

      setResult(comparisonResult);
      setState('completed');
      setProgress({ stage: 'Complete', percentage: 100 });
      setCurrentDifferenceIndex(0);
      onComplete?.(comparisonResult);

      return comparisonResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Comparison failed';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    }
  }, [mode, visualThreshold, scale, getPdfData, checkCache, saveToCache, onComplete, onError]);

  const compareTextOnly = useCallback(async (
    pdf1: ArrayBuffer | File,
    pdf2: ArrayBuffer | File
  ): Promise<TextComparisonResult | null> => {
    if (cancelledRef.current) return null;

    try {
      setState('comparing');
      setProgress({ stage: 'Comparing text...', percentage: 0 });
      setError(null);

      const data1 = await getPdfData(pdf1);
      const data2 = await getPdfData(pdf2);

      if (cancelledRef.current) return null;

      const result = await compareTextCore(data1, data2, (info) => {
        if (cancelledRef.current) return;
        setProgress(info);
      });

      if (cancelledRef.current) return null;

      setState('completed');
      setProgress({ stage: 'Complete', percentage: 100 });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Text comparison failed';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    }
  }, [getPdfData, onError]);

  const compareVisually = useCallback(async (
    pdf1: ArrayBuffer | File,
    pdf2: ArrayBuffer | File
  ): Promise<VisualPageDiff[] | null> => {
    if (cancelledRef.current) return null;

    try {
      setState('comparing');
      setProgress({ stage: 'Comparing visually...', percentage: 0 });
      setError(null);

      const data1 = await getPdfData(pdf1);
      const data2 = await getPdfData(pdf2);

      if (cancelledRef.current) return null;

      const result = await compareVisualCore(data1, data2, {
        threshold: visualThreshold,
        scale,
        onProgress: (info) => {
          if (cancelledRef.current) return;
          setProgress(info);
        },
      });

      setState('completed');
      setProgress({ stage: 'Complete', percentage: 100 });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Visual comparison failed';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    }
  }, [getPdfData, visualThreshold, scale, onError]);

  const checkIdentical = useCallback(async (
    pdf1: ArrayBuffer | File,
    pdf2: ArrayBuffer | File
  ): Promise<boolean> => {
    try {
      const data1 = await getPdfData(pdf1);
      const data2 = await getPdfData(pdf2);
      return arePDFsIdenticalCore(data1, data2);
    } catch {
      return false;
    }
  }, [getPdfData]);

  const getReport = useCallback((): string | null => {
    if (!result) return null;
    return generateDiffReport(result);
  }, [result]);

  const getPageDifferences = useCallback((pageNum: number): PageComparison | null => {
    if (!result) return null;
    return result.pages.find(p => p.pageNum === pageNum) ?? null;
  }, [result]);

  const getTextDiff = useCallback((): LineDiff[] | null => {
    if (!result?.textDiff) return null;
    return result.textDiff;
  }, [result]);

  const nextDifference = useCallback((): number | null => {
    if (!result || totalDifferences === 0) return null;
    const newIndex = (currentDifferenceIndex + 1) % totalDifferences;
    setCurrentDifferenceIndex(newIndex);
    return newIndex;
  }, [result, totalDifferences, currentDifferenceIndex]);

  const prevDifference = useCallback((): number | null => {
    if (!result || totalDifferences === 0) return null;
    const newIndex = currentDifferenceIndex === 0
      ? totalDifferences - 1
      : currentDifferenceIndex - 1;
    setCurrentDifferenceIndex(newIndex);
    return newIndex;
  }, [result, totalDifferences, currentDifferenceIndex]);

  return {
    state,
    progress,
    result,
    error,
    mode,
    setMode,
    compare,
    compareTextOnly,
    compareVisually,
    checkIdentical,
    getReport,
    getPageDifferences,
    getTextDiff,
    nextDifference,
    prevDifference,
    currentDifferenceIndex,
    totalDifferences,
    cancel,
    reset,
  };
}

export default usePdfComparison;
