/**
 * PDF text search and replace operations for @pdflover/pdf-core
 *
 * Uses PDF.js for text extraction with positions and pdf-lib for modifications.
 * Note: Text replacement in PDFs is limited due to PDF structure complexity.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { loadPDFDocument, measureTime } from './utils.js';
import type { Rect, Color } from './edit.js';
import type { ProgressCallback } from '@pdflover/shared';

/**
 * Options for text search operations
 */
export interface SearchOptions {
  /** Enable case-sensitive search (default: false) */
  caseSensitive?: boolean;
  /** Match whole words only (default: false) */
  wholeWord?: boolean;
  /** Treat search query as regular expression (default: false) */
  regex?: boolean;
  /** Maximum number of results to return (default: unlimited) */
  maxResults?: number;
}

/**
 * Options for text replacement operations
 */
export interface ReplaceOptions extends SearchOptions {
  /** Replace all occurrences (default: false) */
  replaceAll?: boolean;
  /** Index of specific occurrence to replace (if not replaceAll) */
  occurrenceIndex?: number;
}

/**
 * Represents a single search result with position information
 */
export interface SearchResult {
  /** Page number (1-indexed) */
  page: number;
  /** The matched text */
  text: string;
  /** Bounding rectangle for the match */
  rect: Rect;
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
export interface TextContentItem {
  /** The text string */
  str: string;
  /** Transformation matrix [scaleX, skewY, skewX, scaleY, translateX, translateY] */
  transform: number[];
  /** Width of the text */
  width: number;
  /** Height of the text (font height) */
  height: number;
  /** Font name */
  fontName: string;
  /** Whether this text has an end-of-line marker */
  hasEOL: boolean;
}

/**
 * Page text content with items and styles
 */
export interface PageTextContent {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Full text content of the page */
  text: string;
  /** Individual text items with positions */
  items: TextContentItem[];
  /** Text styles by font name */
  styles: Record<string, { fontFamily: string; ascent: number; descent: number }>;
}

/**
 * Complete text content for a document
 */
export interface DocumentTextContent {
  /** Text content for each page */
  pages: PageTextContent[];
  /** Combined full text from all pages */
  fullText: string;
  /** Total character count */
  characterCount: number;
}

/**
 * Result of a replace operation
 */
export interface ReplaceResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Modified PDF data (if successful) */
  data?: ArrayBuffer;
  /** Error message (if failed) */
  error?: string;
  /** Number of replacements made */
  replacementCount: number;
  /** Duration of the operation in milliseconds */
  duration: number;
}

/**
 * Highlight annotation options
 */
export interface HighlightOptions {
  /** Highlight color (default: yellow) */
  color?: Color;
  /** Opacity of the highlight (0-1, default: 0.35) */
  opacity?: number;
  /** Add a border around the highlight */
  addBorder?: boolean;
  /** Border color */
  borderColor?: Color;
}

/**
 * Build a search pattern from query and options
 */
function buildSearchPattern(query: string, options: SearchOptions): RegExp {
  let pattern: string;

  if (options.regex) {
    pattern = query;
  } else {
    // Escape special regex characters for literal search
    pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  if (options.wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }

  const flags = options.caseSensitive ? 'g' : 'gi';

  try {
    return new RegExp(pattern, flags);
  } catch {
    // If regex is invalid, escape and try again
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, flags);
  }
}

/**
 * Calculate bounding rectangle from text item transform
 */
function calculateRect(item: TextContentItem): Rect {
  const [scaleX, , , scaleY, translateX, translateY] = item.transform;
  const height = Math.abs(item.height * (scaleY || 1));
  const width = Math.abs(item.width * (scaleX || 1));

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
function getContext(text: string, matchStart: number, matchEnd: number, contextLength: number = 30): string {
  const start = Math.max(0, matchStart - contextLength);
  const end = Math.min(text.length, matchEnd + contextLength);

  let context = text.substring(start, end);

  // Add ellipsis if truncated
  if (start > 0) {
    context = '...' + context;
  }
  if (end < text.length) {
    context = context + '...';
  }

  return context;
}

/**
 * Search for text in a PDF document using pre-extracted text content
 *
 * This function expects text content extracted from PDF.js. Use with
 * usePdfDocument hook in the web app for full functionality.
 *
 * @param textContent - Document text content from getTextContent
 * @param query - Search query string
 * @param options - Search options
 * @returns Array of search results with positions
 *
 * @example
 * ```typescript
 * const textContent = await getTextContent(pdfDocument);
 * const results = searchText(textContent, 'hello world', {
 *   caseSensitive: false,
 *   wholeWord: true,
 * });
 * ```
 */
export function searchText(
  textContent: DocumentTextContent,
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  if (!query || query.length === 0) {
    return [];
  }

  const results: SearchResult[] = [];
  const pattern = buildSearchPattern(query, options);
  let globalIndex = 0;

  for (const page of textContent.pages) {
    // Reset lastIndex for each page
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    let charOffset = 0;
    let itemIndex = 0;

    // Build character offset map for items
    const itemOffsets: { start: number; end: number; item: TextContentItem }[] = [];
    for (const item of page.items) {
      itemOffsets.push({
        start: charOffset,
        end: charOffset + item.str.length,
        item,
      });
      charOffset += item.str.length + (item.hasEOL ? 1 : 0);
    }

    // Find all matches in page text
    while ((match = pattern.exec(page.text)) !== null) {
      if (options.maxResults && results.length >= options.maxResults) {
        return results;
      }

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
        // Calculate combined bounding rectangle
        const rects = matchingItems.map(calculateRect);
        const rect: Rect = {
          x: Math.min(...rects.map((r) => r.x)),
          y: Math.min(...rects.map((r) => r.y)),
          width: 0,
          height: Math.max(...rects.map((r) => r.height)),
        };
        rect.width = Math.max(...rects.map((r) => r.x + r.width)) - rect.x;

        results.push({
          page: page.pageNumber,
          text: match[0],
          rect,
          index: globalIndex++,
          context: getContext(page.text, matchStart, matchEnd),
          charOffset: matchStart,
        });
      }

      // Prevent infinite loop for zero-length matches
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
    }
  }

  return results;
}

/**
 * Search for text directly in PDF.js document
 * This is a convenience wrapper that extracts text and searches
 *
 * @param pdfDocument - PDF.js document proxy
 * @param query - Search query string
 * @param options - Search options
 * @param onProgress - Progress callback
 * @returns Array of search results
 */
export async function searchTextInPdf(
  pdfDocument: { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: TextContentItem[] }> }> },
  query: string,
  options: SearchOptions = {},
  onProgress?: ProgressCallback
): Promise<SearchResult[]> {
  if (!query || query.length === 0) {
    return [];
  }

  const results: SearchResult[] = [];
  const pattern = buildSearchPattern(query, options);
  const numPages = pdfDocument.numPages;
  let globalIndex = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.({
      percentage: Math.round((pageNum / numPages) * 100),
      stage: `Searching page ${pageNum} of ${numPages}`,
      currentItem: pageNum,
      totalItems: numPages,
    });

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
      if (options.maxResults && results.length >= options.maxResults) {
        return results;
      }

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
        const rect: Rect = {
          x: Math.min(...rects.map((r) => r.x)),
          y: Math.min(...rects.map((r) => r.y)),
          width: 0,
          height: Math.max(...rects.map((r) => r.height)),
        };
        rect.width = Math.max(...rects.map((r) => r.x + r.width)) - rect.x;

        results.push({
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

  return results;
}

/**
 * Replace text in a PDF document
 *
 * Note: Due to PDF structure complexity, text replacement has limitations:
 * - Original text is covered with a white rectangle
 * - New text is drawn on top using a standard font
 * - Font styling may not match the original
 * - Complex layouts may not preserve perfectly
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param searchQuery - Text to search for
 * @param replaceWith - Replacement text
 * @param searchResults - Pre-computed search results with positions
 * @param options - Replace options
 * @returns ReplaceResult with modified PDF data
 *
 * @example
 * ```typescript
 * const results = await searchTextInPdf(pdfDoc, 'old text');
 * const replaceResult = await replaceText(
 *   pdfData,
 *   'old text',
 *   'new text',
 *   results,
 *   { replaceAll: true }
 * );
 * ```
 */
export async function replaceText(
  pdfData: ArrayBuffer | Uint8Array,
  searchQuery: string,
  replaceWith: string,
  searchResults: SearchResult[],
  options: ReplaceOptions = {}
): Promise<ReplaceResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      if (searchResults.length === 0) {
        return {
          success: true,
          data: pdfData instanceof ArrayBuffer ? pdfData : pdfData.buffer as ArrayBuffer,
          replacementCount: 0,
        };
      }

      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Determine which results to replace
      let resultsToReplace: SearchResult[];
      if (options.replaceAll) {
        resultsToReplace = searchResults;
      } else if (options.occurrenceIndex !== undefined) {
        const target = searchResults[options.occurrenceIndex];
        resultsToReplace = target ? [target] : [];
      } else {
        resultsToReplace = searchResults.slice(0, 1);
      }

      // Apply replacements
      for (const result of resultsToReplace) {
        const pageIndex = result.page - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;

        const page = pages[pageIndex];
        const pageHeight = page.getHeight();
        const rect = result.rect;

        // Cover original text with white rectangle
        page.drawRectangle({
          x: rect.x - 1,
          y: rect.y - 1,
          width: rect.width + 2,
          height: rect.height + 2,
          color: rgb(1, 1, 1),
          opacity: 1,
        });

        // Calculate font size to fit the height
        const fontSize = Math.min(rect.height * 0.85, 12);

        // Draw replacement text
        page.drawText(replaceWith, {
          x: rect.x,
          y: rect.y + (rect.height - fontSize) / 2,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }

      pdfDoc.setModificationDate(new Date());
      const modifiedPdfBytes = await pdfDoc.save();

      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
        replacementCount: resultsToReplace.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to replace text: ${message}`,
        replacementCount: 0,
      };
    }
  });

  return { ...result, duration };
}

/**
 * Add highlight annotations to search results
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param results - Search results to highlight
 * @param options - Highlight options
 * @returns Modified PDF data with highlights
 *
 * @example
 * ```typescript
 * const results = await searchTextInPdf(pdfDoc, 'important');
 * const highlighted = await highlightSearchResults(pdfData, results, {
 *   color: { r: 1, g: 1, b: 0 },
 *   opacity: 0.35,
 * });
 * ```
 */
export async function highlightSearchResults(
  pdfData: ArrayBuffer | Uint8Array,
  results: SearchResult[],
  options: HighlightOptions = {}
): Promise<{ success: boolean; data?: ArrayBuffer; error?: string; duration: number }> {
  const { result, duration } = await measureTime(async () => {
    try {
      if (results.length === 0) {
        return {
          success: true,
          data: pdfData instanceof ArrayBuffer ? pdfData : pdfData.buffer as ArrayBuffer,
        };
      }

      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      const color = options.color ?? { r: 1, g: 1, b: 0 }; // Yellow
      const opacity = options.opacity ?? 0.35;

      // Group results by page for efficiency
      const resultsByPage = new Map<number, SearchResult[]>();
      for (const result of results) {
        if (!resultsByPage.has(result.page)) {
          resultsByPage.set(result.page, []);
        }
        resultsByPage.get(result.page)!.push(result);
      }

      // Apply highlights
      for (const [pageNum, pageResults] of Array.from(resultsByPage.entries())) {
        const pageIndex = pageNum - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;

        const page = pages[pageIndex];

        for (const result of pageResults) {
          const rect = result.rect;

          // Draw highlight rectangle
          page.drawRectangle({
            x: rect.x - 1,
            y: rect.y - 1,
            width: rect.width + 2,
            height: rect.height + 2,
            color: rgb(color.r, color.g, color.b),
            opacity,
          });

          // Add border if requested
          if (options.addBorder) {
            const borderColor = options.borderColor ?? { r: 0.8, g: 0.6, b: 0 };
            page.drawRectangle({
              x: rect.x - 1,
              y: rect.y - 1,
              width: rect.width + 2,
              height: rect.height + 2,
              borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
              borderWidth: 0.5,
            });
          }
        }
      }

      const highlightedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: highlightedPdfBytes.buffer as ArrayBuffer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to highlight search results: ${message}`,
      };
    }
  });

  return { ...result, duration };
}

/**
 * Extract all text content from a PDF document with positions
 *
 * This function works with pre-loaded PDF.js document. For usage in
 * the web app, use with usePdfDocument hook.
 *
 * @param pdfDocument - PDF.js document proxy
 * @param onProgress - Progress callback
 * @returns Document text content with positions
 *
 * @example
 * ```typescript
 * const { pdfDocument } = usePdfDocument();
 * const textContent = await getTextContent(pdfDocument);
 * console.log(textContent.fullText);
 * ```
 */
export async function getTextContent(
  pdfDocument: { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: TextContentItem[]; styles: Record<string, unknown> }> }> },
  onProgress?: ProgressCallback
): Promise<DocumentTextContent> {
  const pages: PageTextContent[] = [];
  const numPages = pdfDocument.numPages;
  let fullText = '';
  let characterCount = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.({
      percentage: Math.round((pageNum / numPages) * 100),
      stage: `Extracting text from page ${pageNum} of ${numPages}`,
      currentItem: pageNum,
      totalItems: numPages,
    });

    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as TextContentItem[];

    // Build page text
    let pageText = '';
    for (const item of items) {
      pageText += item.str;
      if (item.hasEOL) {
        pageText += '\n';
      }
    }

    pages.push({
      pageNumber: pageNum,
      text: pageText,
      items,
      styles: textContent.styles as Record<string, { fontFamily: string; ascent: number; descent: number }>,
    });

    fullText += pageText + '\n\n';
    characterCount += pageText.length;
  }

  return {
    pages,
    fullText: fullText.trim(),
    characterCount,
  };
}

/**
 * Count occurrences of a search query in text content
 *
 * @param textContent - Document text content
 * @param query - Search query
 * @param options - Search options
 * @returns Number of matches found
 */
export function countMatches(
  textContent: DocumentTextContent,
  query: string,
  options: SearchOptions = {}
): number {
  if (!query || query.length === 0) {
    return 0;
  }

  const pattern = buildSearchPattern(query, options);
  let count = 0;

  for (const page of textContent.pages) {
    pattern.lastIndex = 0;
    const matches = page.text.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

/**
 * Find and replace text across multiple pages, returning positions
 * This is useful for preview without modifying the PDF
 *
 * @param textContent - Document text content
 * @param searchQuery - Text to search for
 * @param replaceWith - Replacement text
 * @param options - Search options
 * @returns Preview of replacements with old and new text
 */
export function previewReplacements(
  textContent: DocumentTextContent,
  searchQuery: string,
  replaceWith: string,
  options: SearchOptions = {}
): Array<{ result: SearchResult; preview: string }> {
  const results = searchText(textContent, searchQuery, options);

  return results.map((result) => {
    // Generate preview by replacing in context
    const pattern = buildSearchPattern(searchQuery, { ...options, maxResults: 1 });
    const preview = result.context?.replace(pattern, replaceWith) ?? replaceWith;

    return {
      result,
      preview,
    };
  });
}
