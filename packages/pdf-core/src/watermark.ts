/**
 * PDF watermark functionality for @pdflover/pdf-core
 *
 * Provides text and image watermark operations for PDF documents.
 * All processing runs in the browser using pdf-lib.
 */

import { PDFDocument, rgb, degrees, StandardFonts, PDFPage } from 'pdf-lib';
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
 * Watermark position options
 */
export type WatermarkPosition =
  | 'center'
  | 'diagonal'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/**
 * Options for adding a text watermark
 */
export interface TextWatermarkOptions {
  /** The PDF document or ArrayBuffer */
  document: PDFDocumentType | ArrayBuffer;
  /** Watermark text */
  text: string;
  /** Position of the watermark */
  position?: WatermarkPosition;
  /** Opacity (0-1) */
  opacity?: number;
  /** Font size in points */
  fontSize?: number;
  /** Color in hex format (e.g., '#FF0000') or rgb object */
  color?: string | { r: number; g: number; b: number };
  /** Rotation angle in degrees */
  rotation?: number;
  /** Specific pages to watermark (undefined = all pages) */
  pages?: number[];
  /** Whether to repeat the watermark in a pattern */
  repeat?: boolean;
  /** Spacing between repeated watermarks */
  repeatSpacing?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for adding an image watermark
 */
export interface ImageWatermarkOptions {
  /** The PDF document or ArrayBuffer */
  document: PDFDocumentType | ArrayBuffer;
  /** Image data as ArrayBuffer, Uint8Array, or data URL */
  imageData: ArrayBuffer | Uint8Array | string;
  /** Image type (for raw data) */
  imageType?: 'png' | 'jpg' | 'jpeg';
  /** Position of the watermark */
  position?: WatermarkPosition;
  /** Opacity (0-1) */
  opacity?: number;
  /** Scale factor (1 = original size) */
  scale?: number;
  /** Rotation angle in degrees */
  rotation?: number;
  /** Specific pages to watermark (undefined = all pages) */
  pages?: number[];
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Parse a hex color string to RGB values
 */
function parseColor(color: string | { r: number; g: number; b: number }): {
  r: number;
  g: number;
  b: number;
} {
  if (typeof color === 'object') {
    return color;
  }

  // Remove # if present
  const hex = color.replace('#', '');

  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  return { r, g, b };
}

/**
 * Calculate watermark position on a page
 */
function calculatePosition(
  position: WatermarkPosition,
  pageWidth: number,
  pageHeight: number,
  watermarkWidth: number,
  watermarkHeight: number
): { x: number; y: number } {
  switch (position) {
    case 'center':
    case 'diagonal':
      return {
        x: (pageWidth - watermarkWidth) / 2,
        y: (pageHeight - watermarkHeight) / 2,
      };
    case 'top':
      return {
        x: (pageWidth - watermarkWidth) / 2,
        y: pageHeight - watermarkHeight - 50,
      };
    case 'bottom':
      return {
        x: (pageWidth - watermarkWidth) / 2,
        y: 50,
      };
    case 'top-left':
      return {
        x: 50,
        y: pageHeight - watermarkHeight - 50,
      };
    case 'top-right':
      return {
        x: pageWidth - watermarkWidth - 50,
        y: pageHeight - watermarkHeight - 50,
      };
    case 'bottom-left':
      return {
        x: 50,
        y: 50,
      };
    case 'bottom-right':
      return {
        x: pageWidth - watermarkWidth - 50,
        y: 50,
      };
    default:
      return {
        x: (pageWidth - watermarkWidth) / 2,
        y: (pageHeight - watermarkHeight) / 2,
      };
  }
}

/**
 * Add a text watermark to a PDF document
 *
 * @param options - Text watermark options
 * @returns ProcessingResult with watermarked PDF data
 *
 * @example
 * ```typescript
 * const result = await addTextWatermark({
 *   document: pdfArrayBuffer,
 *   text: 'CONFIDENTIAL',
 *   position: 'diagonal',
 *   opacity: 0.3,
 *   fontSize: 72,
 *   color: '#FF0000',
 *   rotation: -45,
 * });
 * ```
 */
export async function addTextWatermark(
  options: TextWatermarkOptions
): Promise<ProcessingResult> {
  const {
    document,
    text,
    position = 'center',
    opacity = 0.3,
    fontSize = 48,
    color = '#888888',
    rotation = position === 'diagonal' ? -45 : 0,
    pages,
    repeat = false,
    repeatSpacing = 200,
    onProgress,
  } = options;

  const stages = ['Validating document', 'Loading document', 'Adding watermark', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    if (!text || text.trim().length === 0) {
      return createErrorResult('INVALID_PDF', 'Watermark text is required', 0);
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
        return createErrorResult('ENCRYPTED_PDF', 'Cannot watermark encrypted PDF', 0);
      }
      return createErrorResult('CORRUPTED_PDF', 'Failed to load document', 0);
    }

    // Embed font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    reportProgress(1, 100);

    // Stage 2: Add watermark to pages
    reportProgress(2, 0);

    const pdfPages = pdfDoc.getPages();
    const totalPages = pdfPages.length;
    const pagesToProcess = pages ?? Array.from({ length: totalPages }, (_, i) => i + 1);
    const parsedColor = parseColor(color);

    for (let i = 0; i < pagesToProcess.length; i++) {
      const pageNum = pagesToProcess[i]!;
      if (pageNum < 1 || pageNum > totalPages) continue;

      const page = pdfPages[pageNum - 1]!;
      const { width, height } = page.getSize();

      // Calculate text dimensions
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = fontSize;

      if (repeat) {
        // Add repeated watermarks in a pattern
        await addRepeatedTextWatermark(
          page,
          text,
          font,
          fontSize,
          parsedColor,
          opacity,
          rotation,
          repeatSpacing,
          width,
          height
        );
      } else {
        // Add single watermark
        const pos = calculatePosition(position, width, height, textWidth, textHeight);

        page.drawText(text, {
          x: pos.x,
          y: pos.y,
          size: fontSize,
          font,
          color: rgb(parsedColor.r, parsedColor.g, parsedColor.b),
          opacity,
          rotate: degrees(rotation),
        });
      }

      reportProgress(2, ((i + 1) / pagesToProcess.length) * 100, i + 1, pagesToProcess.length);
    }

    // Stage 3: Save document
    reportProgress(3, 0);

    pdfDoc.setProducer('PDFLover');
    pdfDoc.setModificationDate(new Date());

    const watermarkedBytes = await pdfDoc.save();
    const watermarkedBuffer = watermarkedBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return createSuccessResult(
      watermarkedBuffer,
      bytes.byteLength,
      watermarkedBuffer.byteLength,
      0
    );
  });

  if (result.success) {
    return { ...result, duration };
  }
  return { ...result, duration };
}

/**
 * Add repeated text watermarks in a pattern across the page
 */
async function addRepeatedTextWatermark(
  page: PDFPage,
  text: string,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  fontSize: number,
  color: { r: number; g: number; b: number },
  opacity: number,
  rotation: number,
  spacing: number,
  pageWidth: number,
  pageHeight: number
): Promise<void> {
  const textWidth = font.widthOfTextAtSize(text, fontSize);

  // Calculate how many watermarks fit
  const cols = Math.ceil(pageWidth / spacing) + 1;
  const rows = Math.ceil(pageHeight / spacing) + 1;

  // Start from outside the page to cover rotated areas
  const startX = -textWidth;
  const startY = -fontSize;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = startX + col * spacing;
      const y = startY + row * spacing;

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
        opacity,
        rotate: degrees(rotation),
      });
    }
  }
}

/**
 * Add an image watermark to a PDF document
 *
 * @param options - Image watermark options
 * @returns ProcessingResult with watermarked PDF data
 *
 * @example
 * ```typescript
 * const result = await addImageWatermark({
 *   document: pdfArrayBuffer,
 *   imageData: logoArrayBuffer,
 *   imageType: 'png',
 *   position: 'bottom-right',
 *   opacity: 0.5,
 *   scale: 0.3,
 * });
 * ```
 */
export async function addImageWatermark(
  options: ImageWatermarkOptions
): Promise<ProcessingResult> {
  const {
    document,
    imageData,
    imageType,
    position = 'center',
    opacity = 0.3,
    scale = 1,
    rotation = 0,
    pages,
    onProgress,
  } = options;

  const stages = ['Validating', 'Loading document', 'Embedding image', 'Adding watermark', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    if (!imageData) {
      return createErrorResult('INVALID_PDF', 'Image data is required', 0);
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
        return createErrorResult('ENCRYPTED_PDF', 'Cannot watermark encrypted PDF', 0);
      }
      return createErrorResult('CORRUPTED_PDF', 'Failed to load document', 0);
    }

    reportProgress(1, 100);

    // Stage 2: Embed image
    reportProgress(2, 0);

    let embeddedImage: Awaited<ReturnType<PDFDocument['embedPng']>>;
    try {
      // Convert image data to proper format
      let imgBytes: Uint8Array;

      if (typeof imageData === 'string') {
        // Data URL
        const base64 = imageData.split(',')[1] ?? imageData;
        const binaryString = atob(base64);
        imgBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          imgBytes[i] = binaryString.charCodeAt(i);
        }
      } else if (imageData instanceof ArrayBuffer) {
        imgBytes = new Uint8Array(imageData);
      } else {
        imgBytes = imageData;
      }

      // Detect image type from data if not specified
      const type = imageType ?? detectImageType(imgBytes);

      if (type === 'png') {
        embeddedImage = await pdfDoc.embedPng(imgBytes);
      } else {
        embeddedImage = await pdfDoc.embedJpg(imgBytes);
      }
    } catch (error) {
      return createErrorResult(
        'UNSUPPORTED_FORMAT',
        'Failed to embed image. Please use PNG or JPG format.',
        0
      );
    }

    reportProgress(2, 100);

    // Stage 3: Add watermark to pages
    reportProgress(3, 0);

    const pdfPages = pdfDoc.getPages();
    const totalPages = pdfPages.length;
    const pagesToProcess = pages ?? Array.from({ length: totalPages }, (_, i) => i + 1);

    // Calculate scaled dimensions
    const scaledWidth = embeddedImage.width * scale;
    const scaledHeight = embeddedImage.height * scale;

    for (let i = 0; i < pagesToProcess.length; i++) {
      const pageNum = pagesToProcess[i]!;
      if (pageNum < 1 || pageNum > totalPages) continue;

      const page = pdfPages[pageNum - 1]!;
      const { width, height } = page.getSize();

      const pos = calculatePosition(position, width, height, scaledWidth, scaledHeight);

      page.drawImage(embeddedImage, {
        x: pos.x,
        y: pos.y,
        width: scaledWidth,
        height: scaledHeight,
        opacity,
        rotate: degrees(rotation),
      });

      reportProgress(3, ((i + 1) / pagesToProcess.length) * 100, i + 1, pagesToProcess.length);
    }

    // Stage 4: Save document
    reportProgress(4, 0);

    pdfDoc.setProducer('PDFLover');
    pdfDoc.setModificationDate(new Date());

    const watermarkedBytes = await pdfDoc.save();
    const watermarkedBuffer = watermarkedBytes.buffer as ArrayBuffer;

    reportProgress(4, 100);

    return createSuccessResult(
      watermarkedBuffer,
      bytes.byteLength,
      watermarkedBuffer.byteLength,
      0
    );
  });

  if (result.success) {
    return { ...result, duration };
  }
  return { ...result, duration };
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
 * Remove watermarks from a PDF document
 *
 * Note: This function attempts to remove watermarks by recreating the document
 * without certain elements. It may not remove all watermarks, especially those
 * that are part of the page content stream.
 *
 * @param document - PDF document or ArrayBuffer
 * @param onProgress - Progress callback
 * @returns ProcessingResult with the PDF (watermarks may or may not be removed)
 */
export async function removeWatermark(
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
    // This can help remove some watermarks that are added as overlays
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

  if (result.success) {
    return { ...result, duration };
  }
  return { ...result, duration };
}
