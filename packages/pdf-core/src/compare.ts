/**
 * PDF comparison functionality for @pdflover/pdf-core
 *
 * Provides comprehensive PDF comparison including:
 * - Text content comparison (line-by-line diff)
 * - Visual/pixel-level comparison
 * - Layout and structure comparison
 */

import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
import type {
  PDFDocument as PDFDocumentType,
  ProgressCallback,
} from '@pdflover/shared';
import {
  loadPDFDocument,
  getPDFBytes,
  validatePDFBuffer,
  createProgressReporter,
} from './utils.js';

/**
 * Types of differences that can be detected
 */
export type DifferenceType = 'text' | 'image' | 'layout' | 'addition' | 'deletion' | 'modification';

/**
 * Represents a single difference between two PDFs
 */
export interface Difference {
  /** Type of difference */
  type: DifferenceType;
  /** Page number where the difference occurs (1-indexed) */
  pageNumber: number;
  /** Location on the page (x, y, width, height) */
  location: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Original value from PDF 1 (null for additions) */
  oldValue: string | null;
  /** New value from PDF 2 (null for deletions) */
  newValue: string | null;
  /** Description of the difference */
  description?: string;
}

/**
 * Text line with metadata for comparison
 */
export interface TextLine {
  /** Line content */
  text: string;
  /** Page number */
  pageNumber: number;
  /** Line number within page */
  lineNumber: number;
  /** Bounding box */
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Line-by-line diff result
 */
export interface LineDiff {
  /** Line number in original */
  originalLine: number | null;
  /** Line number in modified */
  modifiedLine: number | null;
  /** Type of change */
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  /** Original text (for removed/modified) */
  originalText?: string;
  /** Modified text (for added/modified) */
  modifiedText?: string;
  /** Page number */
  pageNumber: number;
}

/**
 * Comparison result for a single page
 */
export interface PageComparison {
  /** Page number (1-indexed) */
  pageNum: number;
  /** Array of differences found */
  differences: Difference[];
  /** Similarity percentage (0-100) */
  similarity: number;
  /** Text similarity percentage */
  textSimilarity: number;
  /** Visual similarity percentage (if visual comparison performed) */
  visualSimilarity?: number;
  /** Whether pages have same dimensions */
  sameDimensions: boolean;
  /** Diff image data URL (if visual comparison performed) */
  diffImageDataUrl?: string;
}

/**
 * Summary of comparison results
 */
export interface ComparisonSummary {
  /** Total pages in PDF 1 */
  pdf1PageCount: number;
  /** Total pages in PDF 2 */
  pdf2PageCount: number;
  /** Number of pages that changed */
  pagesChanged: number;
  /** Number of pages that are identical */
  pagesIdentical: number;
  /** Total text changes */
  textChanges: number;
  /** Text additions count */
  textAdditions: number;
  /** Text deletions count */
  textDeletions: number;
  /** Text modifications count */
  textModifications: number;
  /** Overall similarity percentage */
  overallSimilarity: number;
  /** Visual similarity percentage (if visual comparison) */
  visualSimilarity?: number;
  /** Time taken for comparison in ms */
  duration: number;
}

/**
 * Complete comparison result
 */
export interface ComparisonResult {
  /** Page-by-page comparison results */
  pages: PageComparison[];
  /** Summary statistics */
  summary: ComparisonSummary;
  /** Line-by-line text diff */
  textDiff?: LineDiff[];
}

/**
 * Options for PDF comparison
 */
export interface CompareOptions {
  /** Compare text content */
  compareText?: boolean;
  /** Perform visual/pixel comparison */
  compareVisual?: boolean;
  /** Threshold for visual difference detection (0-1) */
  visualThreshold?: number;
  /** Color for highlighting additions (hex) */
  additionColor?: string;
  /** Color for highlighting deletions (hex) */
  deletionColor?: string;
  /** Color for highlighting changes (hex) */
  changeColor?: string;
  /** Scale factor for rendering (affects visual comparison quality) */
  scale?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for visual comparison
 */
export interface VisualCompareOptions {
  /** Threshold for detecting differences (0-1, lower = more sensitive) */
  threshold?: number;
  /** Color for highlighting differences (hex) */
  highlightColor?: string;
  /** Overlay opacity (0-1) */
  opacity?: number;
  /** Scale factor for rendering */
  scale?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Visual comparison result for a single page
 */
export interface VisualPageDiff {
  /** Page number */
  pageNum: number;
  /** Diff image as data URL */
  diffImageDataUrl: string;
  /** Similarity percentage (0-100) */
  similarity: number;
  /** Number of different pixels */
  differentPixels: number;
  /** Total pixels compared */
  totalPixels: number;
}

/**
 * Text comparison result
 */
export interface TextComparisonResult {
  /** Line-by-line diff */
  lineDiffs: LineDiff[];
  /** Similarity percentage */
  similarity: number;
  /** Number of additions */
  additions: number;
  /** Number of deletions */
  deletions: number;
  /** Number of modifications */
  modifications: number;
}

/**
 * Extract text content from a PDF for comparison
 */
async function extractTextFromPDF(
  input: ArrayBuffer | PDFDocumentType
): Promise<TextLine[]> {
  const textLines: TextLine[] = [];
  const bytes = getPDFBytes(input).slice();
  const document = await pdfjsLib.getDocument({ data: bytes }).promise;

  try {
    for (let pageIndex = 0; pageIndex < document.numPages; pageIndex++) {
      const page = await document.getPage(pageIndex + 1);
      const content = await page.getTextContent();
      const items = content.items
        .filter((item): item is TextItem => 'str' in item && item.str.trim().length > 0)
        .map((item) => ({
          text: item.str.trim(),
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: Math.max(item.height, Math.abs(item.transform[3])),
          hasEOL: item.hasEOL,
        }))
        .sort((a, b) => Math.abs(a.y - b.y) > 3 ? b.y - a.y : a.x - b.x);

      const lines: Array<{
        parts: typeof items;
        y: number;
      }> = [];
      for (const item of items) {
        const current = lines[lines.length - 1];
        if (!current || Math.abs(current.y - item.y) > 3 || current.parts.at(-1)?.hasEOL) {
          lines.push({ parts: [item], y: item.y });
        } else {
          current.parts.push(item);
        }
      }

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]!;
        const minX = Math.min(...line.parts.map((item) => item.x));
        const minY = Math.min(...line.parts.map((item) => item.y));
        const maxX = Math.max(...line.parts.map((item) => item.x + item.width));
        const maxY = Math.max(...line.parts.map((item) => item.y + item.height));
        let previousEnd = minX;
        const text = line.parts.map((item) => {
          const gap = item.x - previousEnd;
          previousEnd = item.x + item.width;
          return `${gap > Math.max(2, item.height * 0.2) ? ' ' : ''}${item.text}`;
        }).join('').trim();
        if (!text) continue;
        textLines.push({
          text,
          pageNumber: pageIndex + 1,
          lineNumber: lineIndex + 1,
          bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        });
      }
    }
  } finally {
    await document.destroy();
  }

  return textLines;
}

/**
 * Compute Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create a 2D array for memoization
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  );

  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  // Fill the dp table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(
          dp[i - 1]![j]!,     // deletion
          dp[i]![j - 1]!,     // insertion
          dp[i - 1]![j - 1]!  // substitution
        );
      }
    }
  }

  return dp[m]![n]!;
}

/**
 * Calculate similarity percentage between two strings (reserved for future use)
 */
function _calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 100;
  if (str1.length === 0 && str2.length === 0) return 100;
  if (str1.length === 0 || str2.length === 0) return 0;

  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Compute line-by-line diff using Myers diff algorithm (simplified)
 */
function computeLineDiff(
  lines1: TextLine[],
  lines2: TextLine[]
): LineDiff[] {
  const diffs: LineDiff[] = [];

  // Simple line-by-line comparison
  // In production, use a proper diff algorithm like Myers or patience diff
  let i = 0;
  let j = 0;

  while (i < lines1.length || j < lines2.length) {
    const line1 = lines1[i];
    const line2 = lines2[j];

    if (i >= lines1.length) {
      // Addition
      diffs.push({
        originalLine: null,
        modifiedLine: j + 1,
        type: 'added',
        modifiedText: line2!.text,
        pageNumber: line2!.pageNumber,
      });
      j++;
    } else if (j >= lines2.length) {
      // Deletion
      diffs.push({
        originalLine: i + 1,
        modifiedLine: null,
        type: 'removed',
        originalText: line1!.text,
        pageNumber: line1!.pageNumber,
      });
      i++;
    } else if (line1!.text === line2!.text) {
      // Unchanged
      diffs.push({
        originalLine: i + 1,
        modifiedLine: j + 1,
        type: 'unchanged',
        originalText: line1!.text,
        modifiedText: line2!.text,
        pageNumber: line1!.pageNumber,
      });
      i++;
      j++;
    } else {
      // Modified
      diffs.push({
        originalLine: i + 1,
        modifiedLine: j + 1,
        type: 'modified',
        originalText: line1!.text,
        modifiedText: line2!.text,
        pageNumber: line1!.pageNumber,
      });
      i++;
      j++;
    }
  }

  return diffs;
}

/**
 * Compare text content of two PDFs
 *
 * @param pdf1 - First PDF (ArrayBuffer or PDFDocument)
 * @param pdf2 - Second PDF (ArrayBuffer or PDFDocument)
 * @param onProgress - Optional progress callback
 * @returns Text comparison result with line-by-line diff
 */
export async function compareText(
  pdf1: ArrayBuffer | PDFDocumentType,
  pdf2: ArrayBuffer | PDFDocumentType,
  onProgress?: ProgressCallback
): Promise<TextComparisonResult> {
  const stages = ['Loading PDFs', 'Extracting text', 'Computing diff'];
  const reportProgress = createProgressReporter(onProgress, stages);

  // Stage 0: Validate PDFs
  reportProgress(0, 0);
  const validation1 = validatePDFBuffer(getPDFBytes(pdf1));
  if (!validation1.valid) throw new Error(validation1.errorMessage ?? 'First PDF is invalid');
  reportProgress(0, 50);
  const validation2 = validatePDFBuffer(getPDFBytes(pdf2));
  if (!validation2.valid) throw new Error(validation2.errorMessage ?? 'Second PDF is invalid');
  reportProgress(0, 100);

  // Stage 1: Extract text
  reportProgress(1, 0);
  const text1 = await extractTextFromPDF(pdf1);
  reportProgress(1, 50);
  const text2 = await extractTextFromPDF(pdf2);
  reportProgress(1, 100);

  // Stage 2: Compute diff
  reportProgress(2, 0);
  const lineDiffs = computeLineDiff(text1, text2);
  reportProgress(2, 50);

  // Calculate statistics
  let additions = 0;
  let deletions = 0;
  let modifications = 0;
  let unchanged = 0;

  for (const diff of lineDiffs) {
    switch (diff.type) {
      case 'added':
        additions++;
        break;
      case 'removed':
        deletions++;
        break;
      case 'modified':
        modifications++;
        break;
      case 'unchanged':
        unchanged++;
        break;
    }
  }

  const totalLines = lineDiffs.length;
  const similarity = totalLines > 0
    ? Math.round((unchanged / totalLines) * 100)
    : 100;

  reportProgress(2, 100);

  return {
    lineDiffs,
    similarity,
    additions,
    deletions,
    modifications,
  };
}

async function renderPage(
  document: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = globalThis.document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D rendering is unavailable');
  await page.render({
    canvasContext: context,
    viewport,
    background: 'rgb(255,255,255)',
  }).promise;
  return canvas;
}

function parseHexColor(value: string): [number, number, number] {
  const normalized = value.trim().replace(/^#/, '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return [255, 0, 0];
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
}

/**
 * Perform pixel-level visual comparison of two PDFs
 *
 * @param pdf1 - First PDF (ArrayBuffer or PDFDocument)
 * @param pdf2 - Second PDF (ArrayBuffer or PDFDocument)
 * @param options - Visual comparison options
 * @returns Array of visual diff results per page
 */
export async function compareVisual(
  pdf1: ArrayBuffer | PDFDocumentType,
  pdf2: ArrayBuffer | PDFDocumentType,
  options: VisualCompareOptions = {}
): Promise<VisualPageDiff[]> {
  const {
    threshold = 0.1,
    highlightColor = '#ff0000',
    opacity = 0.5,
    scale = 1.5,
    onProgress,
  } = options;

  const stages = ['Loading PDFs', 'Rendering pages', 'Comparing pixels'];
  const reportProgress = createProgressReporter(onProgress, stages);

  if (typeof globalThis.document === 'undefined') {
    throw new Error('Visual PDF comparison requires a browser canvas');
  }

  // Stage 0: Load PDFs with PDF.js so page contents can be rendered.
  reportProgress(0, 0);
  const doc1 = await pdfjsLib.getDocument({ data: getPDFBytes(pdf1).slice() }).promise;
  reportProgress(0, 50);
  const doc2 = await pdfjsLib.getDocument({ data: getPDFBytes(pdf2).slice() }).promise;
  reportProgress(0, 100);

  const pageCount1 = doc1.numPages;
  const pageCount2 = doc2.numPages;
  const maxPages = Math.max(pageCount1, pageCount2);
  const results: VisualPageDiff[] = [];
  const [highlightRed, highlightGreen, highlightBlue] = parseHexColor(highlightColor);
  const normalizedThreshold = Math.max(0, Math.min(1, threshold));
  const normalizedOpacity = Math.max(0, Math.min(1, opacity));

  try {
    for (let i = 0; i < maxPages; i++) {
      const pageNum = i + 1;
      reportProgress(1, (i / Math.max(1, maxPages)) * 100, pageNum, maxPages);
      const canvas1 = pageNum <= pageCount1 ? await renderPage(doc1, pageNum, scale) : undefined;
      const canvas2 = pageNum <= pageCount2 ? await renderPage(doc2, pageNum, scale) : undefined;
      const width = Math.max(canvas1?.width ?? 0, canvas2?.width ?? 0);
      const height = Math.max(canvas1?.height ?? 0, canvas2?.height ?? 0);
      const totalPixels = width * height;
      if (totalPixels === 0) continue;

      const pixels1 = canvas1?.getContext('2d')?.getImageData(0, 0, canvas1.width, canvas1.height).data;
      const pixels2 = canvas2?.getContext('2d')?.getImageData(0, 0, canvas2.width, canvas2.height).data;
      const diffCanvas = globalThis.document.createElement('canvas');
      diffCanvas.width = width;
      diffCanvas.height = height;
      const diffContext = diffCanvas.getContext('2d');
      if (!diffContext) throw new Error('Canvas 2D rendering is unavailable');
      const output = diffContext.createImageData(width, height);
      let differentPixels = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const outputOffset = (y * width + x) * 4;
          const inside1 = Boolean(canvas1 && x < canvas1.width && y < canvas1.height && pixels1);
          const inside2 = Boolean(canvas2 && x < canvas2.width && y < canvas2.height && pixels2);
          const offset1 = canvas1 ? (y * canvas1.width + x) * 4 : 0;
          const offset2 = canvas2 ? (y * canvas2.width + x) * 4 : 0;
          const red1 = inside1 ? pixels1![offset1]! : 255;
          const green1 = inside1 ? pixels1![offset1 + 1]! : 255;
          const blue1 = inside1 ? pixels1![offset1 + 2]! : 255;
          const red2 = inside2 ? pixels2![offset2]! : 255;
          const green2 = inside2 ? pixels2![offset2 + 1]! : 255;
          const blue2 = inside2 ? pixels2![offset2 + 2]! : 255;
          const delta = Math.max(
            Math.abs(red1 - red2),
            Math.abs(green1 - green2),
            Math.abs(blue1 - blue2),
          ) / 255;
          const different = inside1 !== inside2 || delta > normalizedThreshold;
          if (different) {
            differentPixels++;
            output.data[outputOffset] = highlightRed;
            output.data[outputOffset + 1] = highlightGreen;
            output.data[outputOffset + 2] = highlightBlue;
            output.data[outputOffset + 3] = Math.round(normalizedOpacity * 255);
          } else {
            const gray = Math.round((red2 + green2 + blue2) / 3);
            output.data[outputOffset] = gray;
            output.data[outputOffset + 1] = gray;
            output.data[outputOffset + 2] = gray;
            output.data[outputOffset + 3] = 55;
          }
        }
      }

      diffContext.putImageData(output, 0, 0);
      results.push({
        pageNum,
        diffImageDataUrl: diffCanvas.toDataURL('image/png'),
        similarity: Math.round((1 - differentPixels / totalPixels) * 10000) / 100,
        differentPixels,
        totalPixels,
      });
      reportProgress(2, ((i + 1) / maxPages) * 100, pageNum, maxPages);
    }
    return results;
  } finally {
    await Promise.all([doc1.destroy(), doc2.destroy()]);
  }
}

/**
 * Compare two PDF documents comprehensively
 *
 * @param pdf1 - First PDF (ArrayBuffer or PDFDocument)
 * @param pdf2 - Second PDF (ArrayBuffer or PDFDocument)
 * @param options - Comparison options
 * @returns Complete comparison result with page differences and summary
 *
 * @example
 * ```typescript
 * const result = await comparePDFs(pdf1Buffer, pdf2Buffer, {
 *   compareText: true,
 *   compareVisual: true,
 *   visualThreshold: 0.1,
 *   onProgress: (info) => console.log(`${info.percentage}%`),
 * });
 *
 * console.log(`Overall similarity: ${result.summary.overallSimilarity}%`);
 * console.log(`Pages changed: ${result.summary.pagesChanged}`);
 * ```
 */
export async function comparePDFs(
  pdf1: ArrayBuffer | PDFDocumentType,
  pdf2: ArrayBuffer | PDFDocumentType,
  options: CompareOptions = {}
): Promise<ComparisonResult> {
  const {
    compareText: doTextCompare = true,
    compareVisual: doVisualCompare = false,
    visualThreshold = 0.1,
    additionColor: _additionColor = '#22c55e',
    deletionColor: _deletionColor = '#ef4444',
    changeColor = '#eab308',
    scale = 1.5,
    onProgress,
  } = options;

  const startTime = performance.now();
  const stages = [
    'Loading PDFs',
    'Analyzing structure',
    ...(doTextCompare ? ['Comparing text'] : []),
    ...(doVisualCompare ? ['Comparing visually'] : []),
    'Generating summary',
  ];
  const reportProgress = createProgressReporter(onProgress, stages);

  // Stage 0: Load PDFs
  reportProgress(0, 0);

  const bytes1 = getPDFBytes(pdf1 as ArrayBuffer);
  const validation1 = validatePDFBuffer(bytes1);
  if (!validation1.valid) {
    throw new Error(`PDF 1 is invalid: ${validation1.errorMessage}`);
  }

  const bytes2 = getPDFBytes(pdf2 as ArrayBuffer);
  const validation2 = validatePDFBuffer(bytes2);
  if (!validation2.valid) {
    throw new Error(`PDF 2 is invalid: ${validation2.errorMessage}`);
  }

  const doc1 = await loadPDFDocument(pdf1 as ArrayBuffer);
  reportProgress(0, 50);
  const doc2 = await loadPDFDocument(pdf2 as ArrayBuffer);
  reportProgress(0, 100);

  // Stage 1: Analyze structure
  reportProgress(1, 0);
  const pageCount1 = doc1.getPageCount();
  const pageCount2 = doc2.getPageCount();
  const maxPages = Math.max(pageCount1, pageCount2);

  const pageComparisons: PageComparison[] = [];
  let textResult: TextComparisonResult | undefined;
  let visualResults: VisualPageDiff[] | undefined;

  reportProgress(1, 100);

  // Stage 2: Text comparison (if enabled)
  let stageIndex = 2;
  if (doTextCompare) {
    reportProgress(stageIndex, 0);
    textResult = await compareText(pdf1, pdf2);
    reportProgress(stageIndex, 100);
    stageIndex++;
  }

  // Stage 3: Visual comparison (if enabled)
  if (doVisualCompare) {
    reportProgress(stageIndex, 0);
    visualResults = await compareVisual(pdf1, pdf2, {
      threshold: visualThreshold,
      highlightColor: changeColor,
      scale,
    });
    reportProgress(stageIndex, 100);
    stageIndex++;
  }

  // Build page comparisons
  for (let i = 0; i < maxPages; i++) {
    const pageNum = i + 1;
    const hasPage1 = i < pageCount1;
    const hasPage2 = i < pageCount2;

    const differences: Difference[] = [];

    // Check for page presence differences
    if (!hasPage1) {
      differences.push({
        type: 'addition',
        pageNumber: pageNum,
        location: { x: 0, y: 0, width: 0, height: 0 },
        oldValue: null,
        newValue: `Page ${pageNum} added`,
        description: 'Page only exists in second PDF',
      });
    } else if (!hasPage2) {
      differences.push({
        type: 'deletion',
        pageNumber: pageNum,
        location: { x: 0, y: 0, width: 0, height: 0 },
        oldValue: `Page ${pageNum} removed`,
        newValue: null,
        description: 'Page only exists in first PDF',
      });
    }

    // Get page dimensions
    let sameDimensions = true;
    if (hasPage1 && hasPage2) {
      const page1 = doc1.getPage(i);
      const page2 = doc2.getPage(i);
      const size1 = page1.getSize();
      const size2 = page2.getSize();

      sameDimensions =
        Math.abs(size1.width - size2.width) < 1 &&
        Math.abs(size1.height - size2.height) < 1;

      if (!sameDimensions) {
        differences.push({
          type: 'layout',
          pageNumber: pageNum,
          location: { x: 0, y: 0, width: size1.width, height: size1.height },
          oldValue: `${size1.width}x${size1.height}`,
          newValue: `${size2.width}x${size2.height}`,
          description: 'Page dimensions changed',
        });
      }
    }

    const pageTextDiffs = textResult?.lineDiffs.filter((diff) => diff.pageNumber === pageNum) ?? [];
    const pageUnchanged = pageTextDiffs.filter((diff) => diff.type === 'unchanged').length;
    const pageTextSimilarity = pageTextDiffs.length > 0
      ? Math.round((pageUnchanged / pageTextDiffs.length) * 100)
      : 100;
    for (const diff of pageTextDiffs) {
      if (diff.type === 'unchanged') continue;
      differences.push({
        type:
          diff.type === 'added'
            ? 'addition'
            : diff.type === 'removed'
              ? 'deletion'
              : 'modification',
        pageNumber: pageNum,
        location: { x: 0, y: 0, width: 0, height: 0 },
        oldValue: diff.originalText ?? null,
        newValue: diff.modifiedText ?? null,
        description:
          diff.type === 'added'
            ? 'Text line added'
            : diff.type === 'removed'
              ? 'Text line removed'
              : 'Text line changed',
      });
    }

    // Calculate similarities
    const textSimilarity = textResult ? pageTextSimilarity : 100;
    const visualSim = visualResults?.[i]?.similarity;
    const similarity = visualSim !== undefined
      ? Math.round((textSimilarity + visualSim) / 2)
      : textSimilarity;

    pageComparisons.push({
      pageNum,
      differences,
      similarity,
      textSimilarity,
      visualSimilarity: visualSim,
      sameDimensions,
      diffImageDataUrl: visualResults?.[i]?.diffImageDataUrl,
    });
  }

  // Final stage: Generate summary
  reportProgress(stageIndex, 0);

  const pagesChanged = pageComparisons.filter(p => p.differences.length > 0).length;
  const pagesIdentical = pageComparisons.filter(p => p.differences.length === 0).length;

  const overallSimilarity = pageComparisons.length > 0
    ? Math.round(
        pageComparisons.reduce((sum, p) => sum + p.similarity, 0) / pageComparisons.length
      )
    : 100;

  const visualSimilarity = visualResults
    ? Math.round(
        visualResults.reduce((sum, v) => sum + v.similarity, 0) / visualResults.length
      )
    : undefined;

  const duration = Math.round(performance.now() - startTime);

  reportProgress(stageIndex, 100);

  return {
    pages: pageComparisons,
    summary: {
      pdf1PageCount: pageCount1,
      pdf2PageCount: pageCount2,
      pagesChanged,
      pagesIdentical,
      textChanges: textResult
        ? textResult.additions + textResult.deletions + textResult.modifications
        : 0,
      textAdditions: textResult?.additions ?? 0,
      textDeletions: textResult?.deletions ?? 0,
      textModifications: textResult?.modifications ?? 0,
      overallSimilarity,
      visualSimilarity,
      duration,
    },
    textDiff: textResult?.lineDiffs,
  };
}

/**
 * Generate a human-readable diff report
 *
 * @param result - Comparison result from comparePDFs
 * @returns Formatted report as a string
 */
export function generateDiffReport(result: ComparisonResult): string {
  const { summary, pages } = result;
  const lines: string[] = [];

  lines.push('PDF Comparison Report');
  lines.push('=====================');
  lines.push('');

  // Summary section
  lines.push('Summary');
  lines.push('-------');
  lines.push(`PDF 1 Pages: ${summary.pdf1PageCount}`);
  lines.push(`PDF 2 Pages: ${summary.pdf2PageCount}`);
  lines.push(`Overall Similarity: ${summary.overallSimilarity}%`);
  if (summary.visualSimilarity !== undefined) {
    lines.push(`Visual Similarity: ${summary.visualSimilarity}%`);
  }
  lines.push('');
  lines.push(`Pages Changed: ${summary.pagesChanged}`);
  lines.push(`Pages Identical: ${summary.pagesIdentical}`);
  lines.push('');

  // Text changes section
  if (summary.textChanges > 0) {
    lines.push('Text Changes');
    lines.push('------------');
    lines.push(`Additions: ${summary.textAdditions}`);
    lines.push(`Deletions: ${summary.textDeletions}`);
    lines.push(`Modifications: ${summary.textModifications}`);
    lines.push(`Total: ${summary.textChanges}`);
    lines.push('');
  }

  // Page details
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
 * Quick comparison utility - checks if two PDFs are identical
 *
 * @param pdf1 - First PDF
 * @param pdf2 - Second PDF
 * @returns True if PDFs are identical, false otherwise
 */
export async function arePDFsIdentical(
  pdf1: ArrayBuffer | PDFDocumentType,
  pdf2: ArrayBuffer | PDFDocumentType
): Promise<boolean> {
  const bytes1 = getPDFBytes(pdf1 as ArrayBuffer);
  const bytes2 = getPDFBytes(pdf2 as ArrayBuffer);

  // Quick byte-level comparison
  if (bytes1.byteLength !== bytes2.byteLength) {
    return false;
  }

  // Compare bytes
  for (let i = 0; i < bytes1.byteLength; i++) {
    if (bytes1[i] !== bytes2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Compare specific pages from two PDFs
 *
 * @param pdf1 - First PDF
 * @param pdf2 - Second PDF
 * @param pageNum1 - Page number in first PDF (1-indexed)
 * @param pageNum2 - Page number in second PDF (1-indexed)
 * @returns Page comparison result
 */
export async function comparePages(
  pdf1: ArrayBuffer | PDFDocumentType,
  pdf2: ArrayBuffer | PDFDocumentType,
  pageNum1: number,
  pageNum2: number
): Promise<PageComparison> {
  const doc1 = await loadPDFDocument(pdf1 as ArrayBuffer);
  const doc2 = await loadPDFDocument(pdf2 as ArrayBuffer);

  const pageCount1 = doc1.getPageCount();
  const pageCount2 = doc2.getPageCount();

  if (pageNum1 < 1 || pageNum1 > pageCount1) {
    throw new Error(`Page ${pageNum1} out of range for PDF 1 (1-${pageCount1})`);
  }

  if (pageNum2 < 1 || pageNum2 > pageCount2) {
    throw new Error(`Page ${pageNum2} out of range for PDF 2 (1-${pageCount2})`);
  }

  const page1 = doc1.getPage(pageNum1 - 1);
  const page2 = doc2.getPage(pageNum2 - 1);

  const size1 = page1.getSize();
  const size2 = page2.getSize();

  const sameDimensions =
    Math.abs(size1.width - size2.width) < 1 &&
    Math.abs(size1.height - size2.height) < 1;

  const differences: Difference[] = [];

  if (!sameDimensions) {
    differences.push({
      type: 'layout',
      pageNumber: pageNum1,
      location: { x: 0, y: 0, width: size1.width, height: size1.height },
      oldValue: `${size1.width}x${size1.height}`,
      newValue: `${size2.width}x${size2.height}`,
      description: 'Page dimensions differ',
    });
  }

  const lines1 = (await extractTextFromPDF(pdf1)).filter((line) => line.pageNumber === pageNum1);
  const lines2 = (await extractTextFromPDF(pdf2))
    .filter((line) => line.pageNumber === pageNum2)
    .map((line) => ({ ...line, pageNumber: pageNum1 }));
  const textDiffs = computeLineDiff(lines1, lines2);
  const unchanged = textDiffs.filter((diff) => diff.type === 'unchanged').length;
  const textSimilarity = textDiffs.length > 0
    ? Math.round((unchanged / textDiffs.length) * 100)
    : 100;

  for (const diff of textDiffs) {
    if (diff.type === 'unchanged') continue;
    differences.push({
      type:
        diff.type === 'added'
          ? 'addition'
          : diff.type === 'removed'
            ? 'deletion'
            : 'modification',
      pageNumber: pageNum1,
      location: { x: 0, y: 0, width: size1.width, height: size1.height },
      oldValue: diff.originalText ?? null,
      newValue: diff.modifiedText ?? null,
      description: `Text ${diff.type}`,
    });
  }

  const similarity = sameDimensions ? textSimilarity : Math.round(textSimilarity * 0.5);

  return {
    pageNum: pageNum1,
    differences,
    similarity,
    textSimilarity,
    sameDimensions,
  };
}
