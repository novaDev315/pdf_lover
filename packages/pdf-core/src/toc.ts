/**
 * Table of Contents (TOC) generation functionality for @pdflover/pdf-core
 *
 * Uses PDF.js for text extraction with font information
 * and pdf-lib for TOC insertion with clickable links
 */

import { rgb, StandardFonts, PDFPage as PDFLibPage, PDFFont, PDFName, PDFArray } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type {
  ProcessingResult,
  ProgressCallback,
} from '@pdflover/shared';
import {
  loadPDFDocument,
  createErrorResult,
  createProgressReporter,
  measureTime,
  getPDFBytes,
  validatePDFBuffer,
} from './utils.js';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

/**
 * Represents a single Table of Contents entry
 */
export interface TOCEntry {
  /** Unique identifier for the entry */
  id: string;
  /** Entry title/heading text */
  title: string;
  /** Page number (1-indexed) */
  page: number;
  /** Heading level (1 = H1, 2 = H2, etc.) */
  level: number;
  /** Bounding rectangle on the page (in PDF points) */
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Font size of the original heading */
  fontSize?: number;
  /** Children entries (for nested TOC) */
  children?: TOCEntry[];
}

/**
 * Detected heading style from PDF analysis
 */
export interface HeadingStyle {
  /** Heading level (1 = largest, etc.) */
  level: number;
  /** Font size associated with this level */
  fontSize: number;
  /** Whether text is bold */
  isBold: boolean;
  /** Number of occurrences found */
  count: number;
}

/**
 * Options for generating a Table of Contents
 */
export interface GenerateTOCOptions {
  /** Minimum font size to consider as a heading (default: 12) */
  minFontSize?: number;
  /** Maximum heading levels to include (default: 3) */
  maxLevels?: number;
  /** Whether to include page numbers in result (default: true) */
  includePageNumbers?: boolean;
  /** Specific pages to analyze (undefined = all pages) */
  pages?: number[];
  /** Custom heading detection thresholds */
  fontSizeThresholds?: number[];
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for inserting a TOC into a PDF
 */
export interface InsertTOCOptions {
  /** Title for the TOC page (default: "Table of Contents") */
  title?: string;
  /** Font to use for TOC entries */
  font?: 'Helvetica' | 'TimesRoman' | 'Courier';
  /** Font size for TOC entries (default: 12) */
  fontSize?: number;
  /** Line spacing multiplier (default: 1.5) */
  lineSpacing?: number;
  /** Whether to include clickable links to pages (default: true) */
  includeLinks?: boolean;
  /** Whether to include page numbers (default: true) */
  includePageNumbers?: boolean;
  /** Whether to show dotted leaders (default: true) */
  showDottedLeaders?: boolean;
  /** Page margin in points (default: 50) */
  margin?: number;
  /** Title font size (default: 24) */
  titleFontSize?: number;
  /** Indentation per level in points (default: 20) */
  indentPerLevel?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Text item from PDF.js extraction
 */
interface TextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL: boolean;
}

/**
 * Analyzed text block with font information
 */
interface AnalyzedTextBlock {
  text: string;
  fontSize: number;
  fontName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  isBold: boolean;
}

/**
 * Generate a unique ID for TOC entries
 */
function generateTOCId(): string {
  return `toc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determine if a font name indicates bold weight
 */
function isBoldFont(fontName: string): boolean {
  const lowerName = fontName.toLowerCase();
  return (
    lowerName.includes('bold') ||
    lowerName.includes('heavy') ||
    lowerName.includes('black') ||
    lowerName.includes('semibold') ||
    lowerName.includes('demibold')
  );
}

/**
 * Extract text blocks with font information from a PDF page
 */
async function extractTextBlocksFromPage(
  page: pdfjsLib.PDFPageProxy,
  pageNumber: number
): Promise<AnalyzedTextBlock[]> {
  const textContent = await page.getTextContent();
  const blocks: AnalyzedTextBlock[] = [];

  let currentLine: TextItem[] = [];
  let currentY = -1;

  for (const item of textContent.items) {
    const textItem = item as TextItem;
    if (!textItem.str || textItem.str.trim() === '') continue;

    // Get transform matrix to extract position and size
    const transform = textItem.transform;
    const y = transform[5] ?? 0;

    // Check if this is a new line (different Y position)
    if (Math.abs(y - currentY) > 2 && currentLine.length > 0) {
      // Process the previous line
      const lineText = currentLine.map(t => t.str).join('').trim();
      if (lineText) {
        const firstItem = currentLine[0]!;
        const firstTransform = firstItem.transform;
        const ft0 = firstTransform[0] ?? 12;
        const ft3 = firstTransform[3] ?? 12;
        const ft4 = firstTransform[4] ?? 0;
        const lineFontSize = Math.abs(ft0) || Math.abs(ft3) || 12;
        const lineX = ft4;
        const lineWidth = currentLine.reduce((sum, t) => sum + t.width, 0);

        blocks.push({
          text: lineText,
          fontSize: lineFontSize,
          fontName: firstItem.fontName,
          x: lineX,
          y: currentY,
          width: lineWidth,
          height: lineFontSize,
          page: pageNumber,
          isBold: isBoldFont(firstItem.fontName),
        });
      }
      currentLine = [];
    }

    currentLine.push(textItem);
    currentY = y;
  }

  // Process the last line
  if (currentLine.length > 0) {
    const lineText = currentLine.map(t => t.str).join('').trim();
    if (lineText) {
      const firstItem = currentLine[0]!;
      const firstTransform = firstItem.transform;
      const lt0 = firstTransform[0] ?? 12;
      const lt3 = firstTransform[3] ?? 12;
      const lt4 = firstTransform[4] ?? 0;
      const lineFontSize = Math.abs(lt0) || Math.abs(lt3) || 12;
      const lineX = lt4;
      const lineWidth = currentLine.reduce((sum, t) => sum + t.width, 0);

      blocks.push({
        text: lineText,
        fontSize: lineFontSize,
        fontName: firstItem.fontName,
        x: lineX,
        y: currentY,
        width: lineWidth,
        height: lineFontSize,
        page: pageNumber,
        isBold: isBoldFont(firstItem.fontName),
      });
    }
  }

  return blocks;
}

/**
 * Detect heading styles from analyzed text blocks
 */
function detectHeadingStylesFromBlocks(blocks: AnalyzedTextBlock[]): HeadingStyle[] {
  // Count font sizes and their occurrences
  const fontSizeCounts = new Map<number, { count: number; boldCount: number }>();

  for (const block of blocks) {
    const roundedSize = Math.round(block.fontSize);
    const existing = fontSizeCounts.get(roundedSize) || { count: 0, boldCount: 0 };
    existing.count++;
    if (block.isBold) existing.boldCount++;
    fontSizeCounts.set(roundedSize, existing);
  }

  // Sort font sizes in descending order
  const sortedSizes = Array.from(fontSizeCounts.entries())
    .sort((a, b) => b[0] - a[0]);

  // Find the most common font size (likely body text)
  let bodyFontSize = 12;
  let maxCount = 0;
  fontSizeCounts.forEach((data, size) => {
    if (data.count > maxCount) {
      maxCount = data.count;
      bodyFontSize = size;
    }
  });

  // Identify heading styles: font sizes larger than body text or bold
  const headingStyles: HeadingStyle[] = [];
  let level = 1;

  for (const [fontSize, data] of sortedSizes) {
    // Skip if this is body text size and not predominantly bold
    if (fontSize <= bodyFontSize && data.boldCount < data.count / 2) {
      continue;
    }

    // Skip very rare font sizes (likely noise)
    if (data.count < 2 && fontSize <= bodyFontSize) {
      continue;
    }

    headingStyles.push({
      level,
      fontSize,
      isBold: data.boldCount > data.count / 2,
      count: data.count,
    });

    level++;
    if (level > 6) break;
  }

  return headingStyles;
}

/**
 * Identify headings from text blocks based on detected styles
 */
function identifyHeadings(
  blocks: AnalyzedTextBlock[],
  styles: HeadingStyle[],
  options: GenerateTOCOptions
): TOCEntry[] {
  const { minFontSize = 12, maxLevels = 3 } = options;
  const entries: TOCEntry[] = [];

  // Create a map of font size to heading level
  const sizeToLevel = new Map<number, number>();
  for (const style of styles) {
    if (style.level <= maxLevels) {
      sizeToLevel.set(style.fontSize, style.level);
    }
  }

  for (const block of blocks) {
    const roundedSize = Math.round(block.fontSize);
    const level = sizeToLevel.get(roundedSize);

    // Skip if not a heading or below minimum font size
    if (level === undefined || block.fontSize < minFontSize) {
      continue;
    }

    // Skip very short text (likely not a heading)
    if (block.text.length < 3) {
      continue;
    }

    // Skip if text looks like a page number or footnote
    if (/^\d+$/.test(block.text.trim())) {
      continue;
    }

    entries.push({
      id: generateTOCId(),
      title: block.text,
      page: block.page,
      level,
      fontSize: block.fontSize,
      rect: {
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
      },
    });
  }

  return entries;
}

/**
 * Detect heading styles in a PDF document
 *
 * @param pdfData - PDF document as ArrayBuffer
 * @param options - Options for detection
 * @returns Array of detected heading styles
 *
 * @example
 * ```typescript
 * const styles = await detectHeadingStyles(pdfBuffer);
 * console.log(styles); // [{ level: 1, fontSize: 24, isBold: true, count: 5 }, ...]
 * ```
 */
export async function detectHeadingStyles(
  pdfData: ArrayBuffer,
  options?: { pages?: number[]; onProgress?: ProgressCallback }
): Promise<HeadingStyle[]> {
  const { pages, onProgress } = options || {};
  const stages = ['Loading document', 'Analyzing text'];
  const reportProgress = createProgressReporter(onProgress, stages);

  reportProgress(0, 0);

  const bytes = getPDFBytes(pdfData);
  const validation = validatePDFBuffer(bytes);
  if (!validation.valid) {
    throw new Error(validation.errorMessage || 'Invalid PDF');
  }

  // Load with PDF.js for text extraction
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdfDoc = await loadingTask.promise;

  reportProgress(0, 100);
  reportProgress(1, 0);

  const pageCount = pdfDoc.numPages;
  const pagesToAnalyze = pages || Array.from({ length: pageCount }, (_, i) => i + 1);
  const allBlocks: AnalyzedTextBlock[] = [];

  for (let i = 0; i < pagesToAnalyze.length; i++) {
    const pageNum = pagesToAnalyze[i]!;
    if (pageNum < 1 || pageNum > pageCount) continue;

    const page = await pdfDoc.getPage(pageNum);
    const blocks = await extractTextBlocksFromPage(page, pageNum);
    allBlocks.push(...blocks);

    reportProgress(1, ((i + 1) / pagesToAnalyze.length) * 100);
  }

  return detectHeadingStylesFromBlocks(allBlocks);
}

/**
 * Extract headings from a PDF without generating a TOC
 *
 * @param pdfData - PDF document as ArrayBuffer
 * @param options - Extraction options
 * @returns Array of TOC entries representing headings
 *
 * @example
 * ```typescript
 * const headings = await extractHeadings(pdfBuffer, { maxLevels: 2 });
 * headings.forEach(h => console.log(`${h.level}: ${h.title} (page ${h.page})`));
 * ```
 */
export async function extractHeadings(
  pdfData: ArrayBuffer,
  options?: GenerateTOCOptions
): Promise<TOCEntry[]> {
  const opts = options || {};
  const stages = ['Loading document', 'Analyzing styles', 'Extracting headings'];
  const reportProgress = createProgressReporter(opts.onProgress, stages);

  reportProgress(0, 0);

  const bytes = getPDFBytes(pdfData);
  const validation = validatePDFBuffer(bytes);
  if (!validation.valid) {
    throw new Error(validation.errorMessage || 'Invalid PDF');
  }

  // Load with PDF.js for text extraction
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdfDoc = await loadingTask.promise;

  reportProgress(0, 100);
  reportProgress(1, 0);

  const pageCount = pdfDoc.numPages;
  const pagesToAnalyze = opts.pages || Array.from({ length: pageCount }, (_, i) => i + 1);
  const allBlocks: AnalyzedTextBlock[] = [];

  for (let i = 0; i < pagesToAnalyze.length; i++) {
    const pageNum = pagesToAnalyze[i]!;
    if (pageNum < 1 || pageNum > pageCount) continue;

    const page = await pdfDoc.getPage(pageNum);
    const blocks = await extractTextBlocksFromPage(page, pageNum);
    allBlocks.push(...blocks);

    reportProgress(1, ((i + 1) / pagesToAnalyze.length) * 100);
  }

  reportProgress(2, 0);

  // Detect heading styles
  const styles = detectHeadingStylesFromBlocks(allBlocks);

  reportProgress(2, 50);

  // Identify headings
  const headings = identifyHeadings(allBlocks, styles, opts);

  reportProgress(2, 100);

  return headings;
}

/**
 * Generate a Table of Contents from a PDF document
 *
 * @param pdfData - PDF document as ArrayBuffer
 * @param options - TOC generation options
 * @returns Array of TOC entries
 *
 * @example
 * ```typescript
 * const toc = await generateTOC(pdfBuffer, {
 *   minFontSize: 14,
 *   maxLevels: 3,
 * });
 *
 * toc.forEach(entry => {
 *   const indent = '  '.repeat(entry.level - 1);
 *   console.log(`${indent}${entry.title} ... ${entry.page}`);
 * });
 * ```
 */
export async function generateTOC(
  pdfData: ArrayBuffer,
  options?: GenerateTOCOptions
): Promise<TOCEntry[]> {
  return extractHeadings(pdfData, options);
}

/**
 * Calculate the number of TOC pages needed
 */
function calculateTOCPages(
  entries: TOCEntry[],
  options: InsertTOCOptions,
  pageHeight: number
): number {
  const {
    margin = 50,
    fontSize = 12,
    lineSpacing = 1.5,
    titleFontSize = 24,
  } = options;

  const availableHeight = pageHeight - (2 * margin);
  const titleHeight = titleFontSize * 2; // Title plus some spacing
  const lineHeight = fontSize * lineSpacing;

  const linesPerPage = Math.floor((availableHeight - titleHeight) / lineHeight);
  const totalLines = entries.length;

  return Math.ceil(totalLines / linesPerPage);
}

/**
 * Draw dotted leader between entry text and page number
 */
function drawDottedLeader(
  page: PDFLibPage,
  startX: number,
  endX: number,
  y: number,
  font: PDFFont,
  fontSize: number
): void {
  const dotWidth = font.widthOfTextAtSize('.', fontSize);
  const spacing = dotWidth * 2;
  const numDots = Math.floor((endX - startX) / spacing);

  let dots = '';
  for (let i = 0; i < numDots; i++) {
    dots += '. ';
  }

  page.drawText(dots, {
    x: startX,
    y,
    size: fontSize,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
}

/**
 * Insert a Table of Contents into a PDF document
 *
 * @param pdfData - PDF document as ArrayBuffer
 * @param tocEntries - Array of TOC entries to insert
 * @param options - Insertion options
 * @returns ProcessingResult with the modified PDF
 *
 * @example
 * ```typescript
 * const toc = await generateTOC(pdfBuffer);
 * const result = await insertTOC(pdfBuffer, toc, {
 *   title: 'Contents',
 *   includeLinks: true,
 *   font: 'Helvetica',
 * });
 *
 * if (result.success) {
 *   downloadBlob(new Blob([result.data]), 'document-with-toc.pdf');
 * }
 * ```
 */
export async function insertTOC(
  pdfData: ArrayBuffer,
  tocEntries: TOCEntry[],
  options?: InsertTOCOptions
): Promise<ProcessingResult> {
  const opts = options || {};
  const {
    title = 'Table of Contents',
    font = 'Helvetica',
    fontSize = 12,
    lineSpacing = 1.5,
    includeLinks = true,
    includePageNumbers = true,
    showDottedLeaders = true,
    margin = 50,
    titleFontSize = 24,
    indentPerLevel = 20,
    onProgress,
  } = opts;

  const stages = ['Loading document', 'Creating TOC pages', 'Adding links', 'Finalizing'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    reportProgress(0, 0);

    const bytes = getPDFBytes(pdfData);
    const validation = validatePDFBuffer(bytes);
    if (!validation.valid) {
      return createErrorResult(
        validation.errorCode!,
        validation.errorMessage!,
        0
      );
    }

    if (tocEntries.length === 0) {
      return createErrorResult(
        'INVALID_PDF',
        'No TOC entries provided',
        0
      );
    }

    // Load with pdf-lib for modification
    const pdfDoc = await loadPDFDocument(pdfData);

    reportProgress(0, 100);
    reportProgress(1, 0);

    // Get page dimensions from first page
    const firstPage = pdfDoc.getPage(0);
    const { width: pageWidth, height: pageHeight } = firstPage.getSize();

    // Calculate number of TOC pages needed
    const numTOCPages = calculateTOCPages(tocEntries, opts, pageHeight);

    // Get font
    let pdfFont: PDFFont;
    switch (font) {
      case 'TimesRoman':
        pdfFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        break;
      case 'Courier':
        pdfFont = await pdfDoc.embedFont(StandardFonts.Courier);
        break;
      default:
        pdfFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const boldFont = await pdfDoc.embedFont(
      font === 'TimesRoman'
        ? StandardFonts.TimesRomanBold
        : font === 'Courier'
          ? StandardFonts.CourierBold
          : StandardFonts.HelveticaBold
    );

    // Calculate layout
    const lineHeight = fontSize * lineSpacing;
    const titleHeight = titleFontSize + 30;
    const contentTop = pageHeight - margin - titleHeight;
    const contentWidth = pageWidth - (2 * margin);
    const pageNumberWidth = includePageNumbers ? 40 : 0;

    // Create TOC pages
    const tocPages: PDFLibPage[] = [];
    let currentEntryIndex = 0;

    for (let pageIndex = 0; pageIndex < numTOCPages; pageIndex++) {
      const tocPage = pdfDoc.insertPage(pageIndex, [pageWidth, pageHeight]);
      tocPages.push(tocPage);

      // Draw title on first TOC page
      let currentY = pageHeight - margin;
      if (pageIndex === 0) {
        tocPage.drawText(title, {
          x: margin,
          y: currentY - titleFontSize,
          size: titleFontSize,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        currentY = contentTop;
      } else {
        currentY -= 20; // Small top margin for continuation pages
      }

      // Draw entries
      while (currentEntryIndex < tocEntries.length && currentY > margin + lineHeight) {
        const entry = tocEntries[currentEntryIndex]!;
        const indent = (entry.level - 1) * indentPerLevel;
        const textX = margin + indent;
        const maxTextWidth = contentWidth - indent - pageNumberWidth - 20;

        // Truncate title if too long
        let displayTitle = entry.title;
        let titleWidth = pdfFont.widthOfTextAtSize(displayTitle, fontSize);
        while (titleWidth > maxTextWidth && displayTitle.length > 10) {
          displayTitle = displayTitle.slice(0, -4) + '...';
          titleWidth = pdfFont.widthOfTextAtSize(displayTitle, fontSize);
        }

        // Draw entry text
        const textFont = entry.level === 1 ? boldFont : pdfFont;
        tocPage.drawText(displayTitle, {
          x: textX,
          y: currentY,
          size: fontSize,
          font: textFont,
          color: rgb(0, 0, 0),
        });

        // Draw page number
        if (includePageNumbers) {
          // Account for the TOC pages offset
          const displayPageNum = (entry.page + numTOCPages).toString();
          const pageNumWidth = pdfFont.widthOfTextAtSize(displayPageNum, fontSize);
          const pageNumX = pageWidth - margin - pageNumWidth;

          tocPage.drawText(displayPageNum, {
            x: pageNumX,
            y: currentY,
            size: fontSize,
            font: pdfFont,
            color: rgb(0, 0, 0),
          });

          // Draw dotted leaders
          if (showDottedLeaders) {
            const leaderStart = textX + titleWidth + 5;
            const leaderEnd = pageNumX - 5;
            if (leaderEnd - leaderStart > 20) {
              drawDottedLeader(tocPage, leaderStart, leaderEnd, currentY, pdfFont, fontSize);
            }
          }
        }

        currentY -= lineHeight;
        currentEntryIndex++;
      }

      reportProgress(1, ((pageIndex + 1) / numTOCPages) * 100);
    }

    reportProgress(2, 0);

    // Add internal links if requested
    if (includeLinks) {
      for (let pageIndex = 0; pageIndex < tocPages.length; pageIndex++) {
        const tocPage = tocPages[pageIndex]!;
        let currentY = pageIndex === 0 ? contentTop : pageHeight - margin - 20;
        let entryIndex = 0;

        // Calculate starting entry for this page
        const entriesPerPage = Math.ceil(tocEntries.length / numTOCPages);
        const startEntry = pageIndex * entriesPerPage;
        const endEntry = Math.min(startEntry + entriesPerPage, tocEntries.length);

        for (let i = startEntry; i < endEntry && currentY > margin + lineHeight; i++) {
          const entry = tocEntries[i]!;
          const indent = (entry.level - 1) * indentPerLevel;
          const textX = margin + indent;
          const displayTitle = entry.title.length > 50 ? entry.title.slice(0, 47) + '...' : entry.title;
          const titleWidth = pdfFont.widthOfTextAtSize(displayTitle, fontSize);

          // Create link annotation
          const targetPageIndex = entry.page - 1 + numTOCPages;
          if (targetPageIndex >= 0 && targetPageIndex < pdfDoc.getPageCount()) {
            const linkAnnotation = pdfDoc.context.obj({
              Type: 'Annot',
              Subtype: 'Link',
              Rect: [textX, currentY - 2, textX + titleWidth, currentY + fontSize + 2],
              Border: [0, 0, 0],
              Dest: [pdfDoc.getPage(targetPageIndex).ref, 'XYZ', null, null, null],
            });

            const annotsKey = PDFName.of('Annots');
            const annotationsRef = tocPage.node.get(annotsKey);
            if (annotationsRef && annotationsRef instanceof PDFArray) {
              annotationsRef.push(linkAnnotation);
            } else {
              tocPage.node.set(annotsKey, pdfDoc.context.obj([linkAnnotation]));
            }
          }

          currentY -= lineHeight;
          entryIndex++;
        }

        reportProgress(2, ((pageIndex + 1) / tocPages.length) * 100);
      }
    }

    reportProgress(3, 0);

    // Set metadata
    pdfDoc.setProducer('PDFLover');
    pdfDoc.setModificationDate(new Date());

    reportProgress(3, 50);

    // Save the document
    const modifiedBytes = await pdfDoc.save();
    const modifiedBuffer = modifiedBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return {
      success: true,
      data: modifiedBuffer,
      originalSize: bytes.byteLength,
      processedSize: modifiedBuffer.byteLength,
      duration: 0,
    };
  });

  if (result.success) {
    return { ...result, duration };
  }
  return { ...result, duration };
}

/**
 * Generate and insert a TOC in one step
 *
 * @param pdfData - PDF document as ArrayBuffer
 * @param generateOptions - Options for TOC generation
 * @param insertOptions - Options for TOC insertion
 * @returns ProcessingResult with the modified PDF and the generated TOC entries
 *
 * @example
 * ```typescript
 * const result = await generateAndInsertTOC(pdfBuffer, {
 *   maxLevels: 2,
 * }, {
 *   title: 'Contents',
 *   includeLinks: true,
 * });
 *
 * if (result.success) {
 *   console.log(`Generated ${result.tocEntries?.length} entries`);
 * }
 * ```
 */
export async function generateAndInsertTOC(
  pdfData: ArrayBuffer,
  generateOptions?: GenerateTOCOptions,
  insertOptions?: InsertTOCOptions
): Promise<ProcessingResult & { tocEntries?: TOCEntry[] }> {
  try {
    // Generate TOC
    const entries = await generateTOC(pdfData, generateOptions);

    if (entries.length === 0) {
      return {
        success: false,
        error: 'No headings found in the document',
        errorCode: 'INVALID_PDF',
        duration: 0,
      };
    }

    // Insert TOC
    const result = await insertTOC(pdfData, entries, insertOptions);

    return {
      ...result,
      tocEntries: entries,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: message,
      errorCode: 'UNKNOWN_ERROR',
      duration: 0,
    };
  }
}

/**
 * Build a hierarchical TOC structure from flat entries
 *
 * @param entries - Flat array of TOC entries
 * @returns Hierarchical TOC with nested children
 *
 * @example
 * ```typescript
 * const flatTOC = await generateTOC(pdfBuffer);
 * const hierarchicalTOC = buildTOCHierarchy(flatTOC);
 *
 * function printTOC(entries: TOCEntry[], depth = 0) {
 *   entries.forEach(e => {
 *     console.log('  '.repeat(depth) + e.title);
 *     if (e.children) printTOC(e.children, depth + 1);
 *   });
 * }
 * printTOC(hierarchicalTOC);
 * ```
 */
export function buildTOCHierarchy(entries: TOCEntry[]): TOCEntry[] {
  if (entries.length === 0) return [];

  const result: TOCEntry[] = [];
  const stack: TOCEntry[] = [];

  for (const entry of entries) {
    const newEntry: TOCEntry = { ...entry, children: [] };

    // Pop items from stack until we find a parent with lower level
    while (stack.length > 0 && stack[stack.length - 1]!.level >= entry.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // This is a top-level entry
      result.push(newEntry);
    } else {
      // Add as child of the last item on the stack
      const parent = stack[stack.length - 1]!;
      if (!parent.children) parent.children = [];
      parent.children.push(newEntry);
    }

    stack.push(newEntry);
  }

  return result;
}

/**
 * Flatten a hierarchical TOC back to a flat array
 *
 * @param entries - Hierarchical TOC entries
 * @returns Flat array of TOC entries
 */
export function flattenTOCHierarchy(entries: TOCEntry[]): TOCEntry[] {
  const result: TOCEntry[] = [];

  function traverse(items: TOCEntry[]): void {
    for (const item of items) {
      const { children, ...rest } = item;
      result.push(rest as TOCEntry);
      if (children && children.length > 0) {
        traverse(children);
      }
    }
  }

  traverse(entries);
  return result;
}

/**
 * Create a TOC entry manually
 *
 * @param title - Entry title
 * @param page - Page number (1-indexed)
 * @param level - Heading level (1-6)
 * @returns New TOC entry
 */
export function createTOCEntry(
  title: string,
  page: number,
  level: number = 1
): TOCEntry {
  return {
    id: generateTOCId(),
    title,
    page,
    level: Math.max(1, Math.min(6, level)),
  };
}
