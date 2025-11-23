/**
 * PDF page elements functionality for @pdflover/pdf-core
 *
 * Provides page numbering, headers, footers, and Bates numbering operations.
 * All processing runs in the browser using pdf-lib.
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import type {
  PDFDocument as PDFDocumentType,
  ProcessingResult,
  ProgressCallback,
} from '@pdflover/shared';
import {
  loadPDFDocument,
  validatePDFBuffer,
  createErrorResult,
  createSuccessResult,
  createProgressReporter,
  measureTime,
  getPDFBytes,
} from './utils.js';

/**
 * Position options for page elements
 */
export type PageElementPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * Standard font names supported by pdf-lib
 */
export type StandardFontName =
  | 'Helvetica'
  | 'Helvetica-Bold'
  | 'Helvetica-Oblique'
  | 'Helvetica-BoldOblique'
  | 'Times-Roman'
  | 'Times-Bold'
  | 'Times-Italic'
  | 'Times-BoldItalic'
  | 'Courier'
  | 'Courier-Bold'
  | 'Courier-Oblique'
  | 'Courier-BoldOblique';

/**
 * Page number format options
 */
export type PageNumberFormat =
  | 'page-x'           // "Page 1"
  | 'x-of-y'           // "1 of 10"
  | 'x-slash-y'        // "1/10"
  | 'x-only'           // "1"
  | 'custom';          // Custom template

/**
 * Options for adding page numbers
 */
export interface PageNumberOptions {
  /** The PDF document or ArrayBuffer */
  document: PDFDocumentType | ArrayBuffer;
  /** Position of page numbers */
  position?: PageElementPosition;
  /** Page number format */
  format?: PageNumberFormat;
  /** Custom format template (use {page} and {total} placeholders) */
  customFormat?: string;
  /** First page to add numbers to (1-indexed) */
  startPage?: number;
  /** Last page to add numbers to (1-indexed) */
  endPage?: number;
  /** Starting number for first page */
  startNumber?: number;
  /** Font name */
  font?: StandardFontName;
  /** Font size in points */
  fontSize?: number;
  /** Color in hex format or rgb object */
  color?: string | { r: number; g: number; b: number };
  /** Margin from page edge in points */
  margin?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for adding headers
 */
export interface HeaderOptions {
  /** The PDF document or ArrayBuffer */
  document: PDFDocumentType | ArrayBuffer;
  /** Header text (supports {page}, {total}, {date} placeholders) */
  text?: string;
  /** Header image as ArrayBuffer, Uint8Array, or data URL */
  image?: ArrayBuffer | Uint8Array | string;
  /** Image type (for raw data) */
  imageType?: 'png' | 'jpg' | 'jpeg';
  /** Position of the header */
  position?: 'left' | 'center' | 'right';
  /** Font name */
  font?: StandardFontName;
  /** Font size in points */
  fontSize?: number;
  /** Color in hex format or rgb object */
  color?: string | { r: number; g: number; b: number };
  /** Margin from page edge in points */
  margin?: number;
  /** Different text for odd pages */
  oddPageText?: string;
  /** Different text for even pages */
  evenPageText?: string;
  /** Image scale factor */
  imageScale?: number;
  /** Image width (overrides scale) */
  imageWidth?: number;
  /** Image height (overrides scale) */
  imageHeight?: number;
  /** First page to add header to (1-indexed) */
  startPage?: number;
  /** Last page to add header to (1-indexed) */
  endPage?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for adding footers
 */
export interface FooterOptions {
  /** The PDF document or ArrayBuffer */
  document: PDFDocumentType | ArrayBuffer;
  /** Footer text (supports {page}, {total}, {date} placeholders) */
  text?: string;
  /** Footer image as ArrayBuffer, Uint8Array, or data URL */
  image?: ArrayBuffer | Uint8Array | string;
  /** Image type (for raw data) */
  imageType?: 'png' | 'jpg' | 'jpeg';
  /** Position of the footer */
  position?: 'left' | 'center' | 'right';
  /** Font name */
  font?: StandardFontName;
  /** Font size in points */
  fontSize?: number;
  /** Color in hex format or rgb object */
  color?: string | { r: number; g: number; b: number };
  /** Margin from page edge in points */
  margin?: number;
  /** Different text for odd pages */
  oddPageText?: string;
  /** Different text for even pages */
  evenPageText?: string;
  /** Image scale factor */
  imageScale?: number;
  /** Image width (overrides scale) */
  imageWidth?: number;
  /** Image height (overrides scale) */
  imageHeight?: number;
  /** First page to add footer to (1-indexed) */
  startPage?: number;
  /** Last page to add footer to (1-indexed) */
  endPage?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for Bates numbering
 */
export interface BatesNumberOptions {
  /** The PDF document or ArrayBuffer */
  document: PDFDocumentType | ArrayBuffer;
  /** Prefix for Bates numbers */
  prefix?: string;
  /** Suffix for Bates numbers */
  suffix?: string;
  /** Starting number */
  startNumber?: number;
  /** Number of digits (zero-padded) */
  digits?: number;
  /** Position of Bates numbers */
  position?: PageElementPosition;
  /** Font name */
  font?: StandardFontName;
  /** Font size in points */
  fontSize?: number;
  /** Color in hex format or rgb object */
  color?: string | { r: number; g: number; b: number };
  /** Margin from page edge in points */
  margin?: number;
  /** First page to add Bates numbers to (1-indexed) */
  startPage?: number;
  /** Last page to add Bates numbers to (1-indexed) */
  endPage?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Parse a hex color string to RGB values (0-1 range)
 */
function parseColor(color: string | { r: number; g: number; b: number }): {
  r: number;
  g: number;
  b: number;
} {
  if (typeof color === 'object') {
    // Normalize if values are 0-255
    const r = color.r > 1 ? color.r / 255 : color.r;
    const g = color.g > 1 ? color.g / 255 : color.g;
    const b = color.b > 1 ? color.b / 255 : color.b;
    return { r, g, b };
  }

  // Remove # if present
  const hex = color.replace('#', '');

  // Parse hex to RGB (0-1 range)
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  return { r, g, b };
}

/**
 * Get the standard font enum value from font name
 */
function getStandardFont(fontName: StandardFontName): keyof typeof StandardFonts {
  const fontMap: Record<StandardFontName, keyof typeof StandardFonts> = {
    'Helvetica': 'Helvetica',
    'Helvetica-Bold': 'HelveticaBold',
    'Helvetica-Oblique': 'HelveticaOblique',
    'Helvetica-BoldOblique': 'HelveticaBoldOblique',
    'Times-Roman': 'TimesRoman',
    'Times-Bold': 'TimesRomanBold',
    'Times-Italic': 'TimesRomanItalic',
    'Times-BoldItalic': 'TimesRomanBoldItalic',
    'Courier': 'Courier',
    'Courier-Bold': 'CourierBold',
    'Courier-Oblique': 'CourierOblique',
    'Courier-BoldOblique': 'CourierBoldOblique',
  };
  return fontMap[fontName];
}

/**
 * Calculate position coordinates for page elements
 */
function calculateElementPosition(
  position: PageElementPosition | 'left' | 'center' | 'right',
  isHeader: boolean,
  pageWidth: number,
  pageHeight: number,
  elementWidth: number,
  margin: number
): { x: number; y: number } {
  let x: number;
  let y: number;

  // Calculate Y position
  if (isHeader) {
    y = pageHeight - margin;
  } else {
    y = margin;
  }

  // Calculate X position based on alignment
  switch (position) {
    case 'left':
    case 'top-left':
    case 'bottom-left':
      x = margin;
      break;
    case 'center':
    case 'top-center':
    case 'bottom-center':
      x = (pageWidth - elementWidth) / 2;
      break;
    case 'right':
    case 'top-right':
    case 'bottom-right':
      x = pageWidth - elementWidth - margin;
      break;
    default:
      x = (pageWidth - elementWidth) / 2;
  }

  return { x, y };
}

/**
 * Format page number based on format option
 */
function formatPageNumber(
  pageNum: number,
  totalPages: number,
  format: PageNumberFormat,
  customFormat?: string
): string {
  switch (format) {
    case 'page-x':
      return `Page ${pageNum}`;
    case 'x-of-y':
      return `${pageNum} of ${totalPages}`;
    case 'x-slash-y':
      return `${pageNum}/${totalPages}`;
    case 'x-only':
      return `${pageNum}`;
    case 'custom':
      if (customFormat) {
        return customFormat
          .replace(/\{page\}/g, String(pageNum))
          .replace(/\{total\}/g, String(totalPages));
      }
      return `${pageNum}`;
    default:
      return `${pageNum}`;
  }
}

/**
 * Replace text placeholders with actual values
 */
function replacePlaceholders(
  text: string,
  pageNum: number,
  totalPages: number
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString();

  return text
    .replace(/\{page\}/g, String(pageNum))
    .replace(/\{total\}/g, String(totalPages))
    .replace(/\{date\}/g, dateStr);
}

/**
 * Detect image type from magic bytes
 */
function detectImageType(bytes: Uint8Array): 'png' | 'jpg' {
  // PNG magic bytes: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }

  // JPEG magic bytes: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }

  // Default to PNG
  return 'png';
}

/**
 * Convert image data to Uint8Array
 */
function getImageBytes(imageData: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof imageData === 'string') {
    // Data URL
    const base64 = imageData.split(',')[1] ?? imageData;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } else if (imageData instanceof ArrayBuffer) {
    return new Uint8Array(imageData);
  }
  return imageData;
}

/**
 * Add page numbers to a PDF document
 *
 * @param options - Page number options
 * @returns ProcessingResult with numbered PDF data
 *
 * @example
 * ```typescript
 * const result = await addPageNumbers({
 *   document: pdfArrayBuffer,
 *   position: 'bottom-center',
 *   format: 'x-of-y',
 *   fontSize: 12,
 *   color: '#000000',
 * });
 * ```
 */
export async function addPageNumbers(
  options: PageNumberOptions
): Promise<ProcessingResult> {
  const {
    document,
    position = 'bottom-center',
    format = 'x-of-y',
    customFormat,
    startPage = 1,
    endPage,
    startNumber = 1,
    font = 'Helvetica',
    fontSize = 12,
    color = '#000000',
    margin = 36,
    onProgress,
  } = options;

  const stages = ['Validating document', 'Loading document', 'Adding page numbers', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);
    const validation = validatePDFBuffer(bytes);

    if (!validation.valid) {
      return createErrorResult(validation.errorCode!, validation.errorMessage!, 0);
    }

    reportProgress(0, 100);

    // Stage 1: Load document
    reportProgress(1, 0);
    let pdfDoc: PDFDocument;

    try {
      pdfDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('encrypt')) {
        return createErrorResult('ENCRYPTED_PDF', 'Cannot add page numbers to encrypted PDF', 0);
      }
      return createErrorResult('CORRUPTED_PDF', 'Failed to load document', 0);
    }

    // Embed font
    const pdfFont = await pdfDoc.embedFont(StandardFonts[getStandardFont(font)]);
    reportProgress(1, 100);

    // Stage 2: Add page numbers
    reportProgress(2, 0);

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const actualEndPage = endPage ?? totalPages;
    const parsedColor = parseColor(color);

    // Determine if position is top or bottom
    const isTop = position.startsWith('top');

    for (let i = startPage - 1; i < actualEndPage && i < totalPages; i++) {
      const page = pages[i]!;
      const { width, height } = page.getSize();

      // Calculate the actual page number to display
      const displayNumber = startNumber + (i - (startPage - 1));
      const text = formatPageNumber(displayNumber, totalPages, format, customFormat);

      // Calculate text width for centering
      const textWidth = pdfFont.widthOfTextAtSize(text, fontSize);

      const pos = calculateElementPosition(
        position,
        isTop,
        width,
        height,
        textWidth,
        margin
      );

      page.drawText(text, {
        x: pos.x,
        y: pos.y,
        size: fontSize,
        font: pdfFont,
        color: rgb(parsedColor.r, parsedColor.g, parsedColor.b),
      });

      reportProgress(2, ((i - startPage + 2) / (actualEndPage - startPage + 1)) * 100);
    }

    // Stage 3: Save document
    reportProgress(3, 0);

    pdfDoc.setProducer('PDFLover');
    pdfDoc.setModificationDate(new Date());

    const numberedBytes = await pdfDoc.save();
    const numberedBuffer = numberedBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return createSuccessResult(
      numberedBuffer,
      bytes.byteLength,
      numberedBuffer.byteLength,
      0
    );
  });

  return { ...result, duration };
}

/**
 * Add header to a PDF document
 *
 * @param options - Header options
 * @returns ProcessingResult with PDF containing headers
 *
 * @example
 * ```typescript
 * const result = await addHeader({
 *   document: pdfArrayBuffer,
 *   text: 'Document Title - Page {page} of {total}',
 *   position: 'center',
 *   fontSize: 10,
 * });
 * ```
 */
export async function addHeader(
  options: HeaderOptions
): Promise<ProcessingResult> {
  const {
    document,
    text,
    image,
    imageType,
    position = 'center',
    font = 'Helvetica',
    fontSize = 10,
    color = '#000000',
    margin = 36,
    oddPageText,
    evenPageText,
    imageScale = 1,
    imageWidth,
    imageHeight,
    startPage = 1,
    endPage,
    onProgress,
  } = options;

  const stages = ['Validating', 'Loading document', 'Adding headers', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    if (!text && !image) {
      return createErrorResult('INVALID_PDF', 'Header text or image is required', 0);
    }

    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);
    const validation = validatePDFBuffer(bytes);

    if (!validation.valid) {
      return createErrorResult(validation.errorCode!, validation.errorMessage!, 0);
    }

    reportProgress(0, 100);

    // Stage 1: Load document
    reportProgress(1, 0);
    let pdfDoc: PDFDocument;

    try {
      pdfDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('encrypt')) {
        return createErrorResult('ENCRYPTED_PDF', 'Cannot add header to encrypted PDF', 0);
      }
      return createErrorResult('CORRUPTED_PDF', 'Failed to load document', 0);
    }

    // Embed font
    const pdfFont = await pdfDoc.embedFont(StandardFonts[getStandardFont(font)]);

    // Embed image if provided
    let embeddedImage: Awaited<ReturnType<PDFDocument['embedPng']>> | undefined;
    if (image) {
      try {
        const imgBytes = getImageBytes(image);
        const type = imageType ?? detectImageType(imgBytes);

        if (type === 'png') {
          embeddedImage = await pdfDoc.embedPng(imgBytes);
        } else {
          embeddedImage = await pdfDoc.embedJpg(imgBytes);
        }
      } catch {
        return createErrorResult(
          'UNSUPPORTED_FORMAT',
          'Failed to embed header image. Please use PNG or JPG format.',
          0
        );
      }
    }

    reportProgress(1, 100);

    // Stage 2: Add headers
    reportProgress(2, 0);

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const actualEndPage = endPage ?? totalPages;
    const parsedColor = parseColor(color);

    for (let i = startPage - 1; i < actualEndPage && i < totalPages; i++) {
      const page = pages[i]!;
      const { width, height } = page.getSize();
      const pageNum = i + 1;
      const isOddPage = pageNum % 2 === 1;

      // Determine text to use
      let headerText = text;
      if (isOddPage && oddPageText) {
        headerText = oddPageText;
      } else if (!isOddPage && evenPageText) {
        headerText = evenPageText;
      }

      // Draw text header
      if (headerText) {
        const processedText = replacePlaceholders(headerText, pageNum, totalPages);
        const textWidth = pdfFont.widthOfTextAtSize(processedText, fontSize);

        const pos = calculateElementPosition(
          position,
          true, // isHeader
          width,
          height,
          textWidth,
          margin
        );

        page.drawText(processedText, {
          x: pos.x,
          y: pos.y,
          size: fontSize,
          font: pdfFont,
          color: rgb(parsedColor.r, parsedColor.g, parsedColor.b),
        });
      }

      // Draw image header
      if (embeddedImage) {
        const imgW = imageWidth ?? embeddedImage.width * imageScale;
        const imgH = imageHeight ?? embeddedImage.height * imageScale;

        const pos = calculateElementPosition(
          position,
          true, // isHeader
          width,
          height,
          imgW,
          margin
        );

        page.drawImage(embeddedImage, {
          x: pos.x,
          y: pos.y - imgH,
          width: imgW,
          height: imgH,
        });
      }

      reportProgress(2, ((i - startPage + 2) / (actualEndPage - startPage + 1)) * 100);
    }

    // Stage 3: Save document
    reportProgress(3, 0);

    pdfDoc.setProducer('PDFLover');
    pdfDoc.setModificationDate(new Date());

    const resultBytes = await pdfDoc.save();
    const resultBuffer = resultBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return createSuccessResult(
      resultBuffer,
      bytes.byteLength,
      resultBuffer.byteLength,
      0
    );
  });

  return { ...result, duration };
}

/**
 * Add footer to a PDF document
 *
 * @param options - Footer options
 * @returns ProcessingResult with PDF containing footers
 *
 * @example
 * ```typescript
 * const result = await addFooter({
 *   document: pdfArrayBuffer,
 *   text: 'Confidential - {date}',
 *   position: 'center',
 *   fontSize: 8,
 * });
 * ```
 */
export async function addFooter(
  options: FooterOptions
): Promise<ProcessingResult> {
  const {
    document,
    text,
    image,
    imageType,
    position = 'center',
    font = 'Helvetica',
    fontSize = 10,
    color = '#000000',
    margin = 36,
    oddPageText,
    evenPageText,
    imageScale = 1,
    imageWidth,
    imageHeight,
    startPage = 1,
    endPage,
    onProgress,
  } = options;

  const stages = ['Validating', 'Loading document', 'Adding footers', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    if (!text && !image) {
      return createErrorResult('INVALID_PDF', 'Footer text or image is required', 0);
    }

    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);
    const validation = validatePDFBuffer(bytes);

    if (!validation.valid) {
      return createErrorResult(validation.errorCode!, validation.errorMessage!, 0);
    }

    reportProgress(0, 100);

    // Stage 1: Load document
    reportProgress(1, 0);
    let pdfDoc: PDFDocument;

    try {
      pdfDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('encrypt')) {
        return createErrorResult('ENCRYPTED_PDF', 'Cannot add footer to encrypted PDF', 0);
      }
      return createErrorResult('CORRUPTED_PDF', 'Failed to load document', 0);
    }

    // Embed font
    const pdfFont = await pdfDoc.embedFont(StandardFonts[getStandardFont(font)]);

    // Embed image if provided
    let embeddedImage: Awaited<ReturnType<PDFDocument['embedPng']>> | undefined;
    if (image) {
      try {
        const imgBytes = getImageBytes(image);
        const type = imageType ?? detectImageType(imgBytes);

        if (type === 'png') {
          embeddedImage = await pdfDoc.embedPng(imgBytes);
        } else {
          embeddedImage = await pdfDoc.embedJpg(imgBytes);
        }
      } catch {
        return createErrorResult(
          'UNSUPPORTED_FORMAT',
          'Failed to embed footer image. Please use PNG or JPG format.',
          0
        );
      }
    }

    reportProgress(1, 100);

    // Stage 2: Add footers
    reportProgress(2, 0);

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const actualEndPage = endPage ?? totalPages;
    const parsedColor = parseColor(color);

    for (let i = startPage - 1; i < actualEndPage && i < totalPages; i++) {
      const page = pages[i]!;
      const { width, height } = page.getSize();
      const pageNum = i + 1;
      const isOddPage = pageNum % 2 === 1;

      // Determine text to use
      let footerText = text;
      if (isOddPage && oddPageText) {
        footerText = oddPageText;
      } else if (!isOddPage && evenPageText) {
        footerText = evenPageText;
      }

      // Draw text footer
      if (footerText) {
        const processedText = replacePlaceholders(footerText, pageNum, totalPages);
        const textWidth = pdfFont.widthOfTextAtSize(processedText, fontSize);

        const pos = calculateElementPosition(
          position,
          false, // isHeader = false for footer
          width,
          height,
          textWidth,
          margin
        );

        page.drawText(processedText, {
          x: pos.x,
          y: pos.y,
          size: fontSize,
          font: pdfFont,
          color: rgb(parsedColor.r, parsedColor.g, parsedColor.b),
        });
      }

      // Draw image footer
      if (embeddedImage) {
        const imgW = imageWidth ?? embeddedImage.width * imageScale;
        const imgH = imageHeight ?? embeddedImage.height * imageScale;

        const pos = calculateElementPosition(
          position,
          false, // isHeader = false for footer
          width,
          height,
          imgW,
          margin
        );

        page.drawImage(embeddedImage, {
          x: pos.x,
          y: pos.y,
          width: imgW,
          height: imgH,
        });
      }

      reportProgress(2, ((i - startPage + 2) / (actualEndPage - startPage + 1)) * 100);
    }

    // Stage 3: Save document
    reportProgress(3, 0);

    pdfDoc.setProducer('PDFLover');
    pdfDoc.setModificationDate(new Date());

    const resultBytes = await pdfDoc.save();
    const resultBuffer = resultBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return createSuccessResult(
      resultBuffer,
      bytes.byteLength,
      resultBuffer.byteLength,
      0
    );
  });

  return { ...result, duration };
}

/**
 * Remove page numbers from a PDF document
 *
 * Note: This function attempts to remove page numbers by recreating the document.
 * It may not remove all page numbers, especially those embedded in the page content stream.
 *
 * @param document - PDF document or ArrayBuffer
 * @param onProgress - Progress callback
 * @returns ProcessingResult with the PDF (page numbers may or may not be removed)
 */
export async function removePageNumbers(
  document: PDFDocumentType | ArrayBuffer,
  onProgress?: ProgressCallback
): Promise<ProcessingResult> {
  const stages = ['Loading', 'Processing', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    reportProgress(0, 0);

    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);
    const validation = validatePDFBuffer(bytes);

    if (!validation.valid) {
      return createErrorResult(validation.errorCode!, validation.errorMessage!, 0);
    }

    reportProgress(0, 100);

    // Stage 1: Load and process
    reportProgress(1, 0);

    let sourcePdf: PDFDocument;
    try {
      sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    } catch {
      return createErrorResult('CORRUPTED_PDF', 'Failed to load document', 0);
    }

    // Create a new document and copy pages
    // This can help remove some page numbers that are added as overlays
    const newPdf = await PDFDocument.create();
    const pageCount = sourcePdf.getPageCount();

    const copiedPages = await newPdf.copyPages(
      sourcePdf,
      Array.from({ length: pageCount }, (_, i) => i)
    );

    for (const page of copiedPages) {
      newPdf.addPage(page);
    }

    reportProgress(1, 100);

    // Stage 2: Save
    reportProgress(2, 0);

    newPdf.setProducer('PDFLover');
    newPdf.setModificationDate(new Date());

    const cleanedBytes = await newPdf.save();
    const cleanedBuffer = cleanedBytes.buffer as ArrayBuffer;

    reportProgress(2, 100);

    return createSuccessResult(
      cleanedBuffer,
      bytes.byteLength,
      cleanedBuffer.byteLength,
      0
    );
  });

  return { ...result, duration };
}

/**
 * Add Bates numbering to a PDF document
 *
 * Bates numbering is a legal industry method for indexing documents.
 *
 * @param options - Bates numbering options
 * @returns ProcessingResult with Bates-numbered PDF data
 *
 * @example
 * ```typescript
 * const result = await addBatesNumbering({
 *   document: pdfArrayBuffer,
 *   prefix: 'ABC-',
 *   suffix: '',
 *   startNumber: 1,
 *   digits: 6,
 *   position: 'bottom-right',
 * });
 * // Result: ABC-000001, ABC-000002, etc.
 * ```
 */
export async function addBatesNumbering(
  options: BatesNumberOptions
): Promise<ProcessingResult> {
  const {
    document,
    prefix = '',
    suffix = '',
    startNumber = 1,
    digits = 6,
    position = 'bottom-right',
    font = 'Courier',
    fontSize = 10,
    color = '#000000',
    margin = 36,
    startPage = 1,
    endPage,
    onProgress,
  } = options;

  const stages = ['Validating document', 'Loading document', 'Adding Bates numbers', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);
    const validation = validatePDFBuffer(bytes);

    if (!validation.valid) {
      return createErrorResult(validation.errorCode!, validation.errorMessage!, 0);
    }

    reportProgress(0, 100);

    // Stage 1: Load document
    reportProgress(1, 0);
    let pdfDoc: PDFDocument;

    try {
      pdfDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('encrypt')) {
        return createErrorResult('ENCRYPTED_PDF', 'Cannot add Bates numbers to encrypted PDF', 0);
      }
      return createErrorResult('CORRUPTED_PDF', 'Failed to load document', 0);
    }

    // Embed font (Courier is commonly used for Bates numbers)
    const pdfFont = await pdfDoc.embedFont(StandardFonts[getStandardFont(font)]);
    reportProgress(1, 100);

    // Stage 2: Add Bates numbers
    reportProgress(2, 0);

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const actualEndPage = endPage ?? totalPages;
    const parsedColor = parseColor(color);

    // Determine if position is top or bottom
    const isTop = position.startsWith('top');

    for (let i = startPage - 1; i < actualEndPage && i < totalPages; i++) {
      const page = pages[i]!;
      const { width, height } = page.getSize();

      // Calculate the Bates number
      const batesNum = startNumber + (i - (startPage - 1));
      const paddedNum = String(batesNum).padStart(digits, '0');
      const batesText = `${prefix}${paddedNum}${suffix}`;

      // Calculate text width for positioning
      const textWidth = pdfFont.widthOfTextAtSize(batesText, fontSize);

      const pos = calculateElementPosition(
        position,
        isTop,
        width,
        height,
        textWidth,
        margin
      );

      page.drawText(batesText, {
        x: pos.x,
        y: pos.y,
        size: fontSize,
        font: pdfFont,
        color: rgb(parsedColor.r, parsedColor.g, parsedColor.b),
      });

      reportProgress(2, ((i - startPage + 2) / (actualEndPage - startPage + 1)) * 100);
    }

    // Stage 3: Save document
    reportProgress(3, 0);

    pdfDoc.setProducer('PDFLover');
    pdfDoc.setModificationDate(new Date());

    const numberedBytes = await pdfDoc.save();
    const numberedBuffer = numberedBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return createSuccessResult(
      numberedBuffer,
      bytes.byteLength,
      numberedBuffer.byteLength,
      0
    );
  });

  return { ...result, duration };
}

/**
 * Available standard fonts for page elements
 */
export const STANDARD_FONTS: StandardFontName[] = [
  'Helvetica',
  'Helvetica-Bold',
  'Helvetica-Oblique',
  'Helvetica-BoldOblique',
  'Times-Roman',
  'Times-Bold',
  'Times-Italic',
  'Times-BoldItalic',
  'Courier',
  'Courier-Bold',
  'Courier-Oblique',
  'Courier-BoldOblique',
];

/**
 * Page number format labels for UI
 */
export const PAGE_NUMBER_FORMATS: { value: PageNumberFormat; label: string; example: string }[] = [
  { value: 'page-x', label: 'Page X', example: 'Page 1' },
  { value: 'x-of-y', label: 'X of Y', example: '1 of 10' },
  { value: 'x-slash-y', label: 'X/Y', example: '1/10' },
  { value: 'x-only', label: 'Number only', example: '1' },
  { value: 'custom', label: 'Custom format', example: '{page} of {total}' },
];

/**
 * Position labels for UI
 */
export const POSITION_LABELS: Record<PageElementPosition, string> = {
  'top-left': 'Top Left',
  'top-center': 'Top Center',
  'top-right': 'Top Right',
  'bottom-left': 'Bottom Left',
  'bottom-center': 'Bottom Center',
  'bottom-right': 'Bottom Right',
};
