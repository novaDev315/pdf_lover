/**
 * Page transformation functionality for @pdflover/pdf-core
 * Provides crop, resize, trim margins, and rotation operations
 */

import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type {
  PDFDocument as PDFDocumentType,
  ProcessingResult,
  ProgressCallback,
} from '@pdflover/shared';
import {
  loadPDFDocument,
  validatePDFBuffer,
  createErrorResult,
  createProgressReporter,
  measureTime,
  getPDFBytes,
  setMetadata,
  normalizeRotation,
} from './utils.js';

/**
 * Standard paper sizes in points (72 points = 1 inch)
 */
export const PAGE_SIZES = {
  A3: { width: 841.89, height: 1190.55 },
  A4: { width: 595.28, height: 841.89 },
  A5: { width: 419.53, height: 595.28 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
  Tabloid: { width: 792, height: 1224 },
} as const;

export type PageSizeName = keyof typeof PAGE_SIZES;

/**
 * Units for dimension conversion
 */
export type DimensionUnit = 'pt' | 'mm' | 'in' | 'px';

/**
 * Conversion factors to points
 */
const UNIT_TO_POINTS: Record<DimensionUnit, number> = {
  pt: 1,
  mm: 72 / 25.4,
  in: 72,
  px: 72 / 96, // Assuming 96 DPI for pixels
};

/**
 * Convert a value from one unit to points
 */
export function toPoints(value: number, unit: DimensionUnit): number {
  return value * UNIT_TO_POINTS[unit];
}

/**
 * Convert a value from points to another unit
 */
export function fromPoints(value: number, unit: DimensionUnit): number {
  return value / UNIT_TO_POINTS[unit];
}

/**
 * Crop box definition
 */
export interface CropBox {
  /** X offset from left edge */
  x: number;
  /** Y offset from bottom edge */
  y: number;
  /** Width of crop area */
  width: number;
  /** Height of crop area */
  height: number;
}

/**
 * Percentage-based crop box
 */
export interface CropBoxPercent {
  /** Percentage to crop from left (0-100) */
  left: number;
  /** Percentage to crop from right (0-100) */
  right: number;
  /** Percentage to crop from top (0-100) */
  top: number;
  /** Percentage to crop from bottom (0-100) */
  bottom: number;
}

/**
 * Options for cropping pages
 */
export interface CropOptions {
  /** The PDF document or ArrayBuffer to crop */
  document: PDFDocumentType | ArrayBuffer;
  /** Absolute crop box in points */
  cropBox?: CropBox;
  /** Percentage-based cropping */
  cropPercent?: CropBoxPercent;
  /** Pages to crop (1-indexed), undefined = all pages */
  pages?: number[];
  /** Which PDF box to modify */
  boxType?: 'MediaBox' | 'CropBox' | 'TrimBox' | 'BleedBox';
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for resizing pages
 */
export interface ResizeOptions {
  /** The PDF document or ArrayBuffer to resize */
  document: PDFDocumentType | ArrayBuffer;
  /** Target width in points */
  width?: number;
  /** Target height in points */
  height?: number;
  /** Use a preset page size */
  preset?: PageSizeName;
  /** Preserve aspect ratio when resizing */
  preserveAspectRatio?: boolean;
  /** Scale content to fit new size */
  scaleContent?: boolean;
  /** Center content on new page */
  centerContent?: boolean;
  /** Pages to resize (1-indexed), undefined = all pages */
  pages?: number[];
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for trimming margins
 */
export interface TrimOptions {
  /** The PDF document or ArrayBuffer to trim */
  document: PDFDocumentType | ArrayBuffer;
  /** Whitespace threshold (0-255), lower = more aggressive trim */
  threshold?: number;
  /** Padding to add after trimming (in points) */
  padding?: number;
  /** Uniform padding on all sides */
  uniformPadding?: boolean;
  /** Pages to trim (1-indexed), undefined = all pages */
  pages?: number[];
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for setting page size
 */
export interface SetPageSizeOptions {
  /** The PDF document or ArrayBuffer */
  document: PDFDocumentType | ArrayBuffer;
  /** Target page size name */
  size?: PageSizeName;
  /** Custom width in points */
  width?: number;
  /** Custom height in points */
  height?: number;
  /** Scale content to fit */
  scaleContent?: boolean;
  /** Center content on page */
  centerContent?: boolean;
  /** Portrait or landscape orientation */
  orientation?: 'portrait' | 'landscape';
  /** Pages to modify (1-indexed), undefined = all pages */
  pages?: number[];
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for advanced page rotation
 */
export interface RotateAdvancedOptions {
  /** The PDF document or ArrayBuffer */
  document: PDFDocumentType | ArrayBuffer;
  /** Rotation angle in degrees (clockwise) */
  angle: number;
  /** Pages to rotate (1-indexed), undefined = all pages */
  pages?: number[];
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Crop pages to a specified area
 *
 * @param options - Crop options
 * @returns ProcessingResult with cropped PDF
 *
 * @example
 * ```typescript
 * // Crop with absolute dimensions
 * const result = await cropPages({
 *   document: pdfBuffer,
 *   cropBox: { x: 50, y: 50, width: 500, height: 700 },
 *   pages: [1, 2, 3],
 * });
 *
 * // Crop with percentages
 * const result = await cropPages({
 *   document: pdfBuffer,
 *   cropPercent: { left: 10, right: 10, top: 5, bottom: 5 },
 * });
 * ```
 */
export async function cropPages(options: CropOptions): Promise<ProcessingResult> {
  const {
    document,
    cropBox,
    cropPercent,
    pages,
    boxType = 'CropBox',
    onProgress,
  } = options;

  const stages = ['Validating', 'Loading document', 'Cropping pages', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    const bytes = getPDFBytes(document);
    const validation = validatePDFBuffer(bytes);

    if (!validation.valid) {
      return createErrorResult(validation.errorCode!, validation.errorMessage!, 0);
    }

    if (!cropBox && !cropPercent) {
      return createErrorResult(
        'INVALID_PDF',
        'Either cropBox or cropPercent must be provided',
        0
      );
    }

    reportProgress(0, 100);

    // Stage 1: Load document
    reportProgress(1, 0);

    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    } catch {
      return createErrorResult('CORRUPTED_PDF', 'Failed to load PDF document', 0);
    }

    const pageCount = pdfDoc.getPageCount();
    reportProgress(1, 100);

    // Stage 2: Crop pages
    reportProgress(2, 0);

    const targetPages = pages ?? Array.from({ length: pageCount }, (_, i) => i + 1);

    for (let i = 0; i < targetPages.length; i++) {
      const pageNum = targetPages[i]!;
      if (pageNum < 1 || pageNum > pageCount) continue;

      const page = pdfDoc.getPage(pageNum - 1);
      const { width, height } = page.getSize();

      let finalCropBox: CropBox;

      if (cropPercent) {
        // Calculate absolute crop box from percentages
        const leftOffset = (cropPercent.left / 100) * width;
        const rightOffset = (cropPercent.right / 100) * width;
        const topOffset = (cropPercent.top / 100) * height;
        const bottomOffset = (cropPercent.bottom / 100) * height;

        finalCropBox = {
          x: leftOffset,
          y: bottomOffset,
          width: width - leftOffset - rightOffset,
          height: height - topOffset - bottomOffset,
        };
      } else {
        finalCropBox = cropBox!;
      }

      // Apply the crop box based on type
      switch (boxType) {
        case 'MediaBox':
          page.setMediaBox(
            finalCropBox.x,
            finalCropBox.y,
            finalCropBox.width,
            finalCropBox.height
          );
          break;
        case 'CropBox':
          page.setCropBox(
            finalCropBox.x,
            finalCropBox.y,
            finalCropBox.width,
            finalCropBox.height
          );
          break;
        case 'TrimBox':
          page.setTrimBox(
            finalCropBox.x,
            finalCropBox.y,
            finalCropBox.width,
            finalCropBox.height
          );
          break;
        case 'BleedBox':
          page.setBleedBox(
            finalCropBox.x,
            finalCropBox.y,
            finalCropBox.width,
            finalCropBox.height
          );
          break;
      }

      reportProgress(2, ((i + 1) / targetPages.length) * 100, i + 1, targetPages.length);
    }

    // Stage 3: Save
    reportProgress(3, 0);

    setMetadata(pdfDoc, {
      producer: 'PDFLover',
      modificationDate: new Date(),
    });

    const savedBytes = await pdfDoc.save();
    const savedBuffer = savedBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return {
      success: true,
      data: savedBuffer,
      originalSize: bytes.byteLength,
      processedSize: savedBuffer.byteLength,
      duration: 0,
    };
  });

  return { ...result, duration };
}

/**
 * Resize pages to new dimensions
 *
 * @param options - Resize options
 * @returns ProcessingResult with resized PDF
 *
 * @example
 * ```typescript
 * // Resize to A4
 * const result = await resizePages({
 *   document: pdfBuffer,
 *   preset: 'A4',
 *   scaleContent: true,
 * });
 *
 * // Resize with custom dimensions
 * const result = await resizePages({
 *   document: pdfBuffer,
 *   width: 600,
 *   height: 800,
 *   preserveAspectRatio: true,
 * });
 * ```
 */
export async function resizePages(options: ResizeOptions): Promise<ProcessingResult> {
  const {
    document,
    width,
    height,
    preset,
    preserveAspectRatio = false,
    scaleContent = true,
    centerContent = true,
    pages,
    onProgress,
  } = options;

  const stages = ['Validating', 'Loading document', 'Resizing pages', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    const bytes = getPDFBytes(document);
    const validation = validatePDFBuffer(bytes);

    if (!validation.valid) {
      return createErrorResult(validation.errorCode!, validation.errorMessage!, 0);
    }

    // Determine target dimensions
    let targetWidth: number;
    let targetHeight: number;

    if (preset && PAGE_SIZES[preset]) {
      targetWidth = PAGE_SIZES[preset].width;
      targetHeight = PAGE_SIZES[preset].height;
    } else if (width && height) {
      targetWidth = width;
      targetHeight = height;
    } else {
      return createErrorResult(
        'INVALID_PDF',
        'Either preset or width/height must be provided',
        0
      );
    }

    reportProgress(0, 100);

    // Stage 1: Load document
    reportProgress(1, 0);

    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    } catch {
      return createErrorResult('CORRUPTED_PDF', 'Failed to load PDF document', 0);
    }

    const pageCount = pdfDoc.getPageCount();
    reportProgress(1, 100);

    // Stage 2: Resize pages
    reportProgress(2, 0);

    const targetPages = pages ?? Array.from({ length: pageCount }, (_, i) => i + 1);

    for (let i = 0; i < targetPages.length; i++) {
      const pageNum = targetPages[i]!;
      if (pageNum < 1 || pageNum > pageCount) continue;

      const page = pdfDoc.getPage(pageNum - 1);
      const { width: currentWidth, height: currentHeight } = page.getSize();

      let finalWidth = targetWidth;
      let finalHeight = targetHeight;

      if (preserveAspectRatio) {
        const currentAspect = currentWidth / currentHeight;
        const targetAspect = targetWidth / targetHeight;

        if (currentAspect > targetAspect) {
          // Width is the limiting factor
          finalHeight = targetWidth / currentAspect;
        } else {
          // Height is the limiting factor
          finalWidth = targetHeight * currentAspect;
        }
      }

      if (scaleContent) {
        // Calculate scale factors
        const scaleX = finalWidth / currentWidth;
        const scaleY = finalHeight / currentHeight;

        // For content scaling, we use the smaller scale to maintain aspect ratio
        const scale = Math.min(scaleX, scaleY);

        // Calculate translation for centering
        let translateX = 0;
        let translateY = 0;

        if (centerContent) {
          const scaledWidth = currentWidth * scale;
          const scaledHeight = currentHeight * scale;
          translateX = (finalWidth - scaledWidth) / 2;
          translateY = (finalHeight - scaledHeight) / 2;
        }

        // Apply transformation to page content
        page.scaleContent(scale, scale);
        page.translateContent(translateX / scale, translateY / scale);
      }

      // Set new page size
      page.setSize(finalWidth, finalHeight);

      reportProgress(2, ((i + 1) / targetPages.length) * 100, i + 1, targetPages.length);
    }

    // Stage 3: Save
    reportProgress(3, 0);

    setMetadata(pdfDoc, {
      producer: 'PDFLover',
      modificationDate: new Date(),
    });

    const savedBytes = await pdfDoc.save();
    const savedBuffer = savedBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return {
      success: true,
      data: savedBuffer,
      originalSize: bytes.byteLength,
      processedSize: savedBuffer.byteLength,
      duration: 0,
    };
  });

  return { ...result, duration };
}

/**
 * Auto-detect and trim white margins from pages by rendering the selected
 * pages and finding the bounding box of non-background pixels.
 *
 * @param options - Trim options
 * @returns ProcessingResult with trimmed PDF
 */
export async function trimMargins(options: TrimOptions): Promise<ProcessingResult> {
  const {
    document,
    threshold = 250,
    padding = 10,
    uniformPadding = true,
    pages,
    onProgress,
  } = options;

  const stages = ['Validating', 'Loading document', 'Analyzing margins', 'Trimming pages', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    const bytes = getPDFBytes(document);
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
    } catch {
      return createErrorResult('CORRUPTED_PDF', 'Failed to load PDF document', 0);
    }

    const pageCount = pdfDoc.getPageCount();
    reportProgress(1, 100);

    // Stage 2: Render pages and analyze their pixel bounds.
    reportProgress(2, 0);

    const targetPages = pages ?? Array.from({ length: pageCount }, (_, i) => i + 1);
    const validPages = targetPages.filter((page) => page >= 1 && page <= pageCount);
    if (validPages.length === 0) {
      return createErrorResult('PAGE_OUT_OF_RANGE', 'No valid pages were selected', 0);
    }
    if (typeof globalThis.document === 'undefined') {
      return createErrorResult(
        'UNKNOWN_ERROR',
        'Automatic margin detection requires a browser canvas',
        0,
      );
    }

    const renderedDocument = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    const detectedBounds = new Map<number, CropBox>();
    try {
      for (let i = 0; i < validPages.length; i++) {
        const pageNumber = validPages[i]!;
        const renderedPage = await renderedDocument.getPage(pageNumber);
        const viewport = renderedPage.getViewport({ scale: 1.5, rotation: 0 });
        const canvas = globalThis.document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas 2D rendering is unavailable');
        await renderedPage.render({
          canvasContext: context,
          viewport,
          background: 'rgb(255,255,255)',
        }).promise;

        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const offset = (y * canvas.width + x) * 4;
            const alpha = pixels[offset + 3]!;
            const isContent = alpha > 8 && (
              pixels[offset]! < threshold ||
              pixels[offset + 1]! < threshold ||
              pixels[offset + 2]! < threshold
            );
            if (!isContent) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }

        const sourcePage = pdfDoc.getPage(pageNumber - 1);
        const { width, height } = sourcePage.getSize();
        if (maxX < minX || maxY < minY) {
          detectedBounds.set(pageNumber, { x: 0, y: 0, width, height });
        } else {
          const xScale = width / canvas.width;
          const yScale = height / canvas.height;
          const detectedLeft = minX * xScale;
          const detectedRight = (canvas.width - maxX - 1) * xScale;
          const detectedTop = minY * yScale;
          const detectedBottom = (canvas.height - maxY - 1) * yScale;
          const edgePadding = Math.max(0, padding);
          const left = Math.max(0, detectedLeft - edgePadding);
          const right = Math.max(left, Math.min(width, width - detectedRight + edgePadding));
          const bottom = Math.max(0, detectedBottom - edgePadding);
          const top = Math.max(bottom, Math.min(height, height - detectedTop + edgePadding));
          detectedBounds.set(pageNumber, {
            x: left,
            y: bottom,
            width: right - left,
            height: top - bottom,
          });
        }
        reportProgress(2, ((i + 1) / validPages.length) * 100, i + 1, validPages.length);
      }
    } finally {
      await renderedDocument.destroy();
    }

    if (uniformPadding && detectedBounds.size > 1) {
      const commonLeft = Math.min(...[...detectedBounds.values()].map((box) => box.x));
      const commonBottom = Math.min(...[...detectedBounds.values()].map((box) => box.y));
      const commonRightMargin = Math.min(...[...detectedBounds.entries()].map(([pageNumber, box]) => {
        const { width } = pdfDoc.getPage(pageNumber - 1).getSize();
        return width - box.x - box.width;
      }));
      const commonTopMargin = Math.min(...[...detectedBounds.entries()].map(([pageNumber, box]) => {
        const { height } = pdfDoc.getPage(pageNumber - 1).getSize();
        return height - box.y - box.height;
      }));
      for (const pageNumber of validPages) {
        const { width, height } = pdfDoc.getPage(pageNumber - 1).getSize();
        detectedBounds.set(pageNumber, {
          x: commonLeft,
          y: commonBottom,
          width: width - commonLeft - commonRightMargin,
          height: height - commonBottom - commonTopMargin,
        });
      }
    }

    reportProgress(2, 100);

    // Stage 3: Trim pages
    reportProgress(3, 0);

    for (let i = 0; i < validPages.length; i++) {
      const pageNum = validPages[i]!;
      const page = pdfDoc.getPage(pageNum - 1);
      const crop = detectedBounds.get(pageNum)!;
      page.setCropBox(crop.x, crop.y, crop.width, crop.height);
      reportProgress(3, ((i + 1) / validPages.length) * 100, i + 1, validPages.length);
    }

    // Stage 4: Save
    reportProgress(4, 0);

    setMetadata(pdfDoc, {
      producer: 'PDFLover',
      modificationDate: new Date(),
    });

    const savedBytes = await pdfDoc.save();
    const savedBuffer = savedBytes.buffer as ArrayBuffer;

    reportProgress(4, 100);

    return {
      success: true,
      data: savedBuffer,
      originalSize: bytes.byteLength,
      processedSize: savedBuffer.byteLength,
      duration: 0,
    };
  });

  return { ...result, duration };
}

/**
 * Set pages to a standard page size
 *
 * @param options - Page size options
 * @returns ProcessingResult with resized PDF
 *
 * @example
 * ```typescript
 * const result = await setPageSize({
 *   document: pdfBuffer,
 *   size: 'A4',
 *   scaleContent: true,
 *   centerContent: true,
 * });
 * ```
 */
export async function setPageSize(options: SetPageSizeOptions): Promise<ProcessingResult> {
  const {
    document,
    size,
    width,
    height,
    scaleContent = true,
    centerContent = true,
    orientation = 'portrait',
    pages,
    onProgress,
  } = options;

  // Determine final dimensions
  let targetWidth: number;
  let targetHeight: number;

  if (size && PAGE_SIZES[size]) {
    targetWidth = PAGE_SIZES[size].width;
    targetHeight = PAGE_SIZES[size].height;
  } else if (width && height) {
    targetWidth = width;
    targetHeight = height;
  } else {
    return {
      success: false,
      error: 'Either size or width/height must be provided',
      errorCode: 'INVALID_PDF',
      duration: 0,
    };
  }

  // Swap dimensions for landscape orientation
  if (orientation === 'landscape') {
    [targetWidth, targetHeight] = [targetHeight, targetWidth];
  }

  return resizePages({
    document,
    width: targetWidth,
    height: targetHeight,
    scaleContent,
    centerContent,
    pages,
    onProgress,
  });
}

/**
 * Rotate specific pages by a given angle
 *
 * @param options - Rotation options
 * @returns ProcessingResult with rotated PDF
 *
 * @example
 * ```typescript
 * const result = await rotatePagesAdvanced({
 *   document: pdfBuffer,
 *   angle: 90,
 *   pages: [1, 3, 5],
 * });
 * ```
 */
export async function rotatePagesAdvanced(
  options: RotateAdvancedOptions
): Promise<ProcessingResult> {
  const { document, angle, pages, onProgress } = options;

  const stages = ['Validating', 'Loading document', 'Rotating pages', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    const bytes = getPDFBytes(document);
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
    } catch {
      return createErrorResult('CORRUPTED_PDF', 'Failed to load PDF document', 0);
    }

    const pageCount = pdfDoc.getPageCount();
    reportProgress(1, 100);

    // Stage 2: Rotate pages
    reportProgress(2, 0);

    const targetPages = pages ?? Array.from({ length: pageCount }, (_, i) => i + 1);
    const normalizedAngle = normalizeRotation(angle);

    for (let i = 0; i < targetPages.length; i++) {
      const pageNum = targetPages[i]!;
      if (pageNum < 1 || pageNum > pageCount) continue;

      const page = pdfDoc.getPage(pageNum - 1);
      const currentRotation = page.getRotation().angle;
      const newRotation = normalizeRotation(currentRotation + normalizedAngle);

      page.setRotation(degrees(newRotation));

      reportProgress(2, ((i + 1) / targetPages.length) * 100, i + 1, targetPages.length);
    }

    // Stage 3: Save
    reportProgress(3, 0);

    setMetadata(pdfDoc, {
      producer: 'PDFLover',
      modificationDate: new Date(),
    });

    const savedBytes = await pdfDoc.save();
    const savedBuffer = savedBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return {
      success: true,
      data: savedBuffer,
      originalSize: bytes.byteLength,
      processedSize: savedBuffer.byteLength,
      duration: 0,
    };
  });

  return { ...result, duration };
}

/**
 * Get page dimensions and boxes information
 *
 * @param document - PDF document or ArrayBuffer
 * @param pageNumber - Page number (1-indexed)
 * @returns Page dimension information
 */
export async function getPageDimensions(
  document: PDFDocumentType | ArrayBuffer,
  pageNumber: number
): Promise<{
  width: number;
  height: number;
  rotation: number;
  mediaBox: CropBox;
  cropBox?: CropBox;
  trimBox?: CropBox;
  bleedBox?: CropBox;
} | null> {
  try {
    const pdfDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    const pageCount = pdfDoc.getPageCount();

    if (pageNumber < 1 || pageNumber > pageCount) {
      return null;
    }

    const page = pdfDoc.getPage(pageNumber - 1);
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle;

    const mediaBox = page.getMediaBox();
    const cropBox = page.getCropBox();
    const trimBox = page.getTrimBox();
    const bleedBox = page.getBleedBox();

    return {
      width,
      height,
      rotation,
      mediaBox: {
        x: mediaBox.x,
        y: mediaBox.y,
        width: mediaBox.width,
        height: mediaBox.height,
      },
      cropBox: cropBox
        ? { x: cropBox.x, y: cropBox.y, width: cropBox.width, height: cropBox.height }
        : undefined,
      trimBox: trimBox
        ? { x: trimBox.x, y: trimBox.y, width: trimBox.width, height: trimBox.height }
        : undefined,
      bleedBox: bleedBox
        ? { x: bleedBox.x, y: bleedBox.y, width: bleedBox.width, height: bleedBox.height }
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Apply crop box to all pages uniformly
 *
 * @param document - PDF document or ArrayBuffer
 * @param margins - Margins to apply { left, right, top, bottom } in points
 * @returns ProcessingResult with cropped PDF
 */
export async function applyUniformMargins(
  document: PDFDocumentType | ArrayBuffer,
  margins: { left: number; right: number; top: number; bottom: number },
  onProgress?: ProgressCallback
): Promise<ProcessingResult> {
  return cropPages({
    document,
    cropPercent: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    onProgress,
  }).then(async () => {
    // Apply margins as absolute crop
    const bytes = getPDFBytes(document);
    const pdfDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    const pageCount = pdfDoc.getPageCount();

    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();

      page.setCropBox(
        margins.left,
        margins.bottom,
        width - margins.left - margins.right,
        height - margins.top - margins.bottom
      );
    }

    setMetadata(pdfDoc, {
      producer: 'PDFLover',
      modificationDate: new Date(),
    });

    const savedBytes = await pdfDoc.save();
    const savedBuffer = savedBytes.buffer as ArrayBuffer;

    return {
      success: true,
      data: savedBuffer,
      originalSize: bytes.byteLength,
      processedSize: savedBuffer.byteLength,
      duration: 0,
    };
  });
}
