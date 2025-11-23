/**
 * Custom hook for PDF text search functionality
 * Provides debounced search, result navigation, and replace capabilities
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * Search result with position information
 */
export interface SearchResult {
  /** Page number (1-indexed) */
  page: number;
  /** The matched text */
  text: string;
  /** Bounding rectangle for the match */
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Index of this match across all pages (0-indexed) */
  index: number;
  /** Context text surrounding the match */
  context?: string;
  /** Character offset within the page text */
  charOffset?: number;
}

/**
 * Text content item from PDF.js
 */
interface TextContentItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Enable case-sensitive search */
  caseSensitive: boolean;
  /** Match whole words only */
  wholeWord: boolean;
  /** Treat query as regular expression */
  regex: boolean;
}

/**
 * Search state
 */
export type SearchState = 'idle' | 'searching' | 'complete' | 'error';

/**
 * Return type for the useTextSearch hook
 */
export interface UseTextSearchReturn {
  /** Current search query */
  query: string;
  /** Set the search query */
  setQuery: (query: string) => void;
  /** Current search options */
  options: SearchOptions;
  /** Set search options */
  setOptions: (options: Partial<SearchOptions>) => void;
  /** Search results */
  results: SearchResult[];
  /** Current search state */
  searchState: SearchState;
  /** Error message if search failed */
  error: string | null;
  /** Current match index (0-indexed) */
  currentMatchIndex: number;
  /** Total number of matches */
  matchCount: number;
  /** Go to next match */
  nextMatch: () => void;
  /** Go to previous match */
  prevMatch: () => void;
  /** Go to specific match by index */
  goToMatch: (index: number) => void;
  /** Current match result (or null if none) */
  currentMatch: SearchResult | null;
  /** Matches on current page */
  matchesOnPage: (pageNumber: number) => SearchResult[];
  /** Execute search immediately */
  search: () => Promise<void>;
  /** Clear search results */
  clearSearch: () => void;
  /** Replace text value */
  replaceText: string;
  /** Set replace text value */
  setReplaceText: (text: string) => void;
  /** Replace current match */
  replaceCurrent: () => Promise<boolean>;
  /** Replace all matches */
  replaceAll: () => Promise<{ count: number; success: boolean }>;
  /** Whether replace is in progress */
  isReplacing: boolean;
}

/**
 * Options for the useTextSearch hook
 */
export interface UseTextSearchOptions {
  /** PDF.js document to search in */
  pdfDocument: PDFDocumentProxy | null;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Callback when search completes */
  onSearchComplete?: (results: SearchResult[]) => void;
  /** Callback when current match changes */
  onMatchChange?: (match: SearchResult | null, index: number) => void;
  /** Callback when replace is requested (to handle PDF modification) */
  onReplace?: (
    searchQuery: string,
    replaceWith: string,
    results: SearchResult[],
    replaceAll: boolean
  ) => Promise<boolean>;
}

/**
 * Build a search pattern from query and options
 */
function buildSearchPattern(query: string, options: SearchOptions): RegExp | null {
  if (!query) return null;

  let pattern: string;

  if (options.regex) {
    pattern = query;
  } else {
    // Escape special regex characters
    pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  if (options.wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }

  const flags = options.caseSensitive ? 'g' : 'gi';

  try {
    return new RegExp(pattern, flags);
  } catch {
    // Invalid regex
    return null;
  }
}

/**
 * Calculate bounding rectangle from text item transform
 */
function calculateRect(item: TextContentItem): SearchResult['rect'] {
  const transform = item.transform;
  const scaleX = transform[0] ?? 1;
  const scaleY = transform[3] ?? 1;
  const translateX = transform[4] ?? 0;
  const translateY = transform[5] ?? 0;
  const height = Math.abs(item.height * scaleY);
  const width = Math.abs(item.width * scaleX);

  return {
    x: translateX,
    y: translateY,
    width,
    height,
  };
}

/**
 * Get context text around a match
 */
function getContext(text: string, matchStart: number, matchEnd: number, contextLength: number = 40): string {
  const start = Math.max(0, matchStart - contextLength);
  const end = Math.min(text.length, matchEnd + contextLength);

  let context = text.substring(start, end);

  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context;
}

/**
 * Custom hook for PDF text search with debouncing and navigation
 *
 * @param options - Hook options
 * @returns Search state and control functions
 *
 * @example
 * ```tsx
 * const { pdfDocument } = usePdfDocument();
 * const search = useTextSearch({
 *   pdfDocument,
 *   onMatchChange: (match) => {
 *     if (match) scrollToPage(match.page);
 *   },
 * });
 *
 * <input
 *   value={search.query}
 *   onChange={(e) => search.setQuery(e.target.value)}
 * />
 * <span>{search.currentMatchIndex + 1} of {search.matchCount}</span>
 * ```
 */
export function useTextSearch(options: UseTextSearchOptions): UseTextSearchReturn {
  const {
    pdfDocument,
    debounceMs = 300,
    onSearchComplete,
    onMatchChange,
    onReplace,
  } = options;

  // State
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isReplacing, setIsReplacing] = useState(false);

  // Refs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  /**
   * Execute search on the PDF document
   */
  const executeSearch = useCallback(async () => {
    if (!pdfDocument || !query) {
      setResults([]);
      setSearchState('idle');
      return;
    }

    // Abort any ongoing search
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    searchAbortRef.current = new AbortController();

    const pattern = buildSearchPattern(query, searchOptions);
    if (!pattern) {
      setError('Invalid search pattern');
      setSearchState('error');
      return;
    }

    setSearchState('searching');
    setError(null);

    try {
      const searchResults: SearchResult[] = [];
      const numPages = pdfDocument.numPages;
      let globalIndex = 0;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        // Check for abort
        if (searchAbortRef.current?.signal.aborted) {
          return;
        }

        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items = textContent.items as TextContentItem[];

        // Build page text and track item positions
        let pageText = '';
        const itemOffsets: { start: number; end: number; item: TextContentItem }[] = [];

        for (const item of items) {
          itemOffsets.push({
            start: pageText.length,
            end: pageText.length + item.str.length,
            item,
          });
          pageText += item.str;
          if (item.hasEOL) {
            pageText += '\n';
          }
        }

        // Reset lastIndex for each page
        pattern.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = pattern.exec(pageText)) !== null) {
          const matchStart = match.index;
          const matchEnd = matchStart + match[0].length;

          // Find the text item(s) that contain this match
          const matchingItems: TextContentItem[] = [];
          for (const { start, end, item } of itemOffsets) {
            if (start < matchEnd && end > matchStart) {
              matchingItems.push(item);
            }
          }

          if (matchingItems.length > 0) {
            const rects = matchingItems.map(calculateRect);
            const rect: SearchResult['rect'] = {
              x: Math.min(...rects.map((r) => r.x)),
              y: Math.min(...rects.map((r) => r.y)),
              width: 0,
              height: Math.max(...rects.map((r) => r.height)),
            };
            rect.width = Math.max(...rects.map((r) => r.x + r.width)) - rect.x;

            searchResults.push({
              page: pageNum,
              text: match[0],
              rect,
              index: globalIndex++,
              context: getContext(pageText, matchStart, matchEnd),
              charOffset: matchStart,
            });
          }

          // Prevent infinite loop
          if (match.index === pattern.lastIndex) {
            pattern.lastIndex++;
          }
        }
      }

      setResults(searchResults);
      setCurrentMatchIndex(searchResults.length > 0 ? 0 : -1);
      setSearchState('complete');
      onSearchComplete?.(searchResults);

      // Notify about first match
      if (searchResults.length > 0) {
        onMatchChange?.(searchResults[0]!, 0);
      } else {
        onMatchChange?.(null, -1);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      setSearchState('error');
    }
  }, [pdfDocument, query, searchOptions, onSearchComplete, onMatchChange]);

  /**
   * Debounced search trigger
   */
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query) {
      setResults([]);
      setSearchState('idle');
      setCurrentMatchIndex(-1);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, searchOptions, pdfDocument, debounceMs, executeSearch]);

  /**
   * Clear search when document changes
   */
  useEffect(() => {
    setResults([]);
    setSearchState('idle');
    setCurrentMatchIndex(-1);
    setQuery('');
    setError(null);
  }, [pdfDocument]);

  /**
   * Navigate to next match
   */
  const nextMatch = useCallback(() => {
    if (results.length === 0) return;

    const nextIndex = (currentMatchIndex + 1) % results.length;
    setCurrentMatchIndex(nextIndex);
    onMatchChange?.(results[nextIndex]!, nextIndex);
  }, [results, currentMatchIndex, onMatchChange]);

  /**
   * Navigate to previous match
   */
  const prevMatch = useCallback(() => {
    if (results.length === 0) return;

    const prevIndex = (currentMatchIndex - 1 + results.length) % results.length;
    setCurrentMatchIndex(prevIndex);
    onMatchChange?.(results[prevIndex]!, prevIndex);
  }, [results, currentMatchIndex, onMatchChange]);

  /**
   * Go to specific match
   */
  const goToMatch = useCallback(
    (index: number) => {
      if (index < 0 || index >= results.length) return;

      setCurrentMatchIndex(index);
      onMatchChange?.(results[index]!, index);
    },
    [results, onMatchChange]
  );

  /**
   * Clear search results
   */
  const clearSearch = useCallback(() => {
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    setQuery('');
    setReplaceText('');
    setResults([]);
    setSearchState('idle');
    setCurrentMatchIndex(-1);
    setError(null);
  }, []);

  /**
   * Update search options
   */
  const updateOptions = useCallback((newOptions: Partial<SearchOptions>) => {
    setSearchOptions((prev) => ({ ...prev, ...newOptions }));
  }, []);

  /**
   * Get matches on a specific page
   */
  const matchesOnPage = useCallback(
    (pageNumber: number) => {
      return results.filter((r) => r.page === pageNumber);
    },
    [results]
  );

  /**
   * Replace current match
   */
  const replaceCurrent = useCallback(async (): Promise<boolean> => {
    if (!onReplace || results.length === 0 || currentMatchIndex < 0) {
      return false;
    }

    setIsReplacing(true);
    try {
      const currentResult = results[currentMatchIndex];
      if (!currentResult) return false;

      const success = await onReplace(query, replaceText, [currentResult], false);

      if (success) {
        // Remove the replaced result and adjust index
        const newResults = results.filter((_, i) => i !== currentMatchIndex);
        setResults(newResults);

        if (newResults.length === 0) {
          setCurrentMatchIndex(-1);
          onMatchChange?.(null, -1);
        } else {
          const newIndex = Math.min(currentMatchIndex, newResults.length - 1);
          setCurrentMatchIndex(newIndex);
          onMatchChange?.(newResults[newIndex]!, newIndex);
        }
      }

      return success;
    } finally {
      setIsReplacing(false);
    }
  }, [query, replaceText, results, currentMatchIndex, onReplace, onMatchChange]);

  /**
   * Replace all matches
   */
  const replaceAll = useCallback(async (): Promise<{ count: number; success: boolean }> => {
    if (!onReplace || results.length === 0) {
      return { count: 0, success: false };
    }

    setIsReplacing(true);
    try {
      const success = await onReplace(query, replaceText, results, true);

      if (success) {
        const count = results.length;
        setResults([]);
        setCurrentMatchIndex(-1);
        onMatchChange?.(null, -1);
        return { count, success: true };
      }

      return { count: 0, success: false };
    } finally {
      setIsReplacing(false);
    }
  }, [query, replaceText, results, onReplace, onMatchChange]);

  /**
   * Current match result
   */
  const currentMatch = useMemo(() => {
    if (currentMatchIndex < 0 || currentMatchIndex >= results.length) {
      return null;
    }
    return results[currentMatchIndex] ?? null;
  }, [results, currentMatchIndex]);

  return {
    query,
    setQuery,
    options: searchOptions,
    setOptions: updateOptions,
    results,
    searchState,
    error,
    currentMatchIndex,
    matchCount: results.length,
    nextMatch,
    prevMatch,
    goToMatch,
    currentMatch,
    matchesOnPage,
    search: executeSearch,
    clearSearch,
    replaceText,
    setReplaceText,
    replaceCurrent,
    replaceAll,
    isReplacing,
  };
}

export default useTextSearch;
