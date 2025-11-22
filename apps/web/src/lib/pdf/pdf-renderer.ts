/**
 * PDF to image rendering utilities for PDFLover
 *
 * Uses PDF.js to render PDF pages to canvas elements and extract
 * image data for OCR processing and image conversion.
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Supported image output formats
 */
export type ImageFormat = 'png' | 'jpeg' | 'webp';

/**
 * Options for rendering a single page
 */
export interface RenderPageOptions {
  /** Scale factor for rendering (default: 1.0) */
  scale?: number;
  /** Background color (default: 'white') */
  backgroundColor?: string;
}

/**
 * Options for rendering all pages
 */
export interface RenderAllPagesOptions extends RenderPageOptions {
  /** Specific pages to render (1-indexed, default: all pages) */
  pages?: number[];
  /** Progress callback */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Options for getting image data
 */
export interface ImageDataOptions extends RenderPageOptions {
  /** Output format (default: 'png') */
  format?: ImageFormat;
  /** Quality for JPEG/WebP (0-1, default: 0.92) */
  quality?: number;
}

/**
 * Result of rendering a page
 */
export interface RenderedPage {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Rendered width in pixels */
  width: number;
  /** Rendered height in pixels */
  height: number;
  /** The canvas element */
  canvas: HTMLCanvasElement;
  /** Original page width in points */
  originalWidth: number;
  /** Original page height in points */
  originalHeight: number;
}

/**
 * Result of rendering a page to an image
 */
export interface RenderedImage {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Image data URL */
  dataUrl: string;
  /** Image format */
  format: ImageFormat;
  /** Rendered width in pixels */
  width: number;
  /** Rendered height in pixels */
  height: number;
}

/**
 * Load a PDF document from various sources
 *
 * @param source - PDF source (ArrayBuffer, Uint8Array, or URL)
 * @returns PDF document proxy
 *
 * @example
 * ```typescript
 * const pdf = await loadPDFDocument(arrayBuffer);
 * console.log(`Loaded ${pdf.numPages} pages`);
 * ```
 */
export async function loadPDFDocument(
  source: ArrayBuffer | Uint8Array | string
): Promise<PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument({
    data: typeof source === 'string' ? undefined : source,
    url: typeof source === 'string' ? source : undefined,
  });

  return loadingTask.promise;
}

/**
 * Render a PDF page to a canvas element
 *
 * @param page - PDF page proxy
 * @param scale - Scale factor (default: 1.0)
 * @param canvas - Optional existing canvas to render to
 * @returns Rendered page information with canvas
 *
 * @example
 * ```typescript
 * const page = await pdf.getPage(1);
 * const result = await renderPageToCanvas(page, 2);
 * document.body.appendChild(result.canvas);
 * ```
 */
export async function renderPageToCanvas(
  page: PDFPageProxy,
  scale: number = 1,
  canvas?: HTMLCanvasElement
): Promise<RenderedPage> {
  const viewport = page.getViewport({ scale });

  // Create canvas if not provided
  const targetCanvas = canvas ?? document.createElement('canvas');
  const context = targetCanvas.getContext('2d');

  if (!context) {
    throw new Error('Could not get canvas 2D context');
  }

  // Set canvas dimensions
  targetCanvas.width = viewport.width;
  targetCanvas.height = viewport.height;

  // Fill with white background (important for PDFs with transparency)
  context.fillStyle = 'white';
  context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

  // Render the page
  const renderContext = {
    canvasContext: context,
    viewport,
  };

  await page.render(renderContext).promise;

  return {
    pageNumber: page.pageNumber,
    width: viewport.width,
    height: viewport.height,
    canvas: targetCanvas,
    originalWidth: page.view[2] ?? viewport.width / scale,
    originalHeight: page.view[3] ?? viewport.height / scale,
  };
}

/**
 * Render a PDF page to an image data URL
 *
 * @param page - PDF page proxy
 * @param options - Rendering options
 * @returns Image data URL and metadata
 *
 * @example
 * ```typescript
 * const page = await pdf.getPage(1);
 * const image = await renderPageToImage(page, {
 *   scale: 2,
 *   format: 'jpeg',
 *   quality: 0.8,
 * });
 * const img = new Image();
 * img.src = image.dataUrl;
 * ```
 */
export async function renderPageToImage(
  page: PDFPageProxy,
  options: ImageDataOptions = {}
): Promise<RenderedImage> {
  const { scale = 1, format = 'png', quality = 0.92 } = options;

  const rendered = await renderPageToCanvas(page, scale);
  const mimeType = `image/${format}`;
  const dataUrl = rendered.canvas.toDataURL(mimeType, quality);

  return {
    pageNumber: page.pageNumber,
    dataUrl,
    format,
    width: rendered.width,
    height: rendered.height,
  };
}

/**
 * Render a PDF page to ImageData (useful for OCR)
 *
 * @param page - PDF page proxy
 * @param scale - Scale factor (default: 1.0)
 * @returns ImageData object
 *
 * @example
 * ```typescript
 * const page = await pdf.getPage(1);
 * const imageData = await renderPageToImageData(page, 2);
 * // Use with OCR
 * const result = await recognizeText(imageData);
 * ```
 */
export async function renderPageToImageData(
  page: PDFPageProxy,
  scale: number = 1
): Promise<ImageData> {
  const rendered = await renderPageToCanvas(page, scale);
  const context = rendered.canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not get canvas 2D context');
  }

  return context.getImageData(0, 0, rendered.width, rendered.height);
}

/**
 * Render all pages of a PDF to canvases
 *
 * @param pdf - PDF document proxy
 * @param options - Rendering options
 * @returns Array of rendered pages
 *
 * @example
 * ```typescript
 * const pages = await renderAllPages(pdf, {
 *   scale: 1.5,
 *   onProgress: (current, total) => console.log(`${current}/${total}`),
 * });
 * ```
 */
export async function renderAllPages(
  pdf: PDFDocumentProxy,
  options: RenderAllPagesOptions = {}
): Promise<RenderedPage[]> {
  const { scale = 1, pages: pageNumbers, onProgress } = options;

  const targetPages = pageNumbers ?? Array.from(
    { length: pdf.numPages },
    (_, i) => i + 1
  );

  const results: RenderedPage[] = [];

  for (let i = 0; i < targetPages.length; i++) {
    const pageNum = targetPages[i]!;

    if (pageNum < 1 || pageNum > pdf.numPages) {
      console.warn(`Page ${pageNum} out of range, skipping`);
      continue;
    }

    const page = await pdf.getPage(pageNum);
    const rendered = await renderPageToCanvas(page, scale);
    results.push(rendered);

    onProgress?.(i + 1, targetPages.length);
  }

  return results;
}

/**
 * Render all pages to images (data URLs)
 *
 * @param pdf - PDF document proxy
 * @param options - Rendering options
 * @returns Array of rendered images
 *
 * @example
 * ```typescript
 * const images = await renderAllPagesToImages(pdf, {
 *   scale: 2,
 *   format: 'jpeg',
 *   quality: 0.8,
 *   onProgress: (c, t) => updateProgress(c / t * 100),
 * });
 * ```
 */
export async function renderAllPagesToImages(
  pdf: PDFDocumentProxy,
  options: RenderAllPagesOptions & ImageDataOptions = {}
): Promise<RenderedImage[]> {
  const { scale = 1, format = 'png', quality = 0.92, pages: pageNumbers, onProgress } = options;

  const targetPages = pageNumbers ?? Array.from(
    { length: pdf.numPages },
    (_, i) => i + 1
  );

  const results: RenderedImage[] = [];

  for (let i = 0; i < targetPages.length; i++) {
    const pageNum = targetPages[i]!;

    if (pageNum < 1 || pageNum > pdf.numPages) {
      console.warn(`Page ${pageNum} out of range, skipping`);
      continue;
    }

    const page = await pdf.getPage(pageNum);
    const image = await renderPageToImage(page, { scale, format, quality });
    results.push(image);

    onProgress?.(i + 1, targetPages.length);
  }

  return results;
}

/**
 * Render all pages to ImageData (for OCR)
 *
 * @param pdf - PDF document proxy
 * @param options - Rendering options
 * @returns Array of ImageData objects
 *
 * @example
 * ```typescript
 * const imageDataArray = await renderAllPagesToImageData(pdf, {
 *   scale: 2, // Higher scale = better OCR accuracy
 * });
 * const ocrResult = await ocrImages(imageDataArray);
 * ```
 */
export async function renderAllPagesToImageData(
  pdf: PDFDocumentProxy,
  options: RenderAllPagesOptions = {}
): Promise<ImageData[]> {
  const { scale = 1, pages: pageNumbers, onProgress } = options;

  const targetPages = pageNumbers ?? Array.from(
    { length: pdf.numPages },
    (_, i) => i + 1
  );

  const results: ImageData[] = [];

  for (let i = 0; i < targetPages.length; i++) {
    const pageNum = targetPages[i]!;

    if (pageNum < 1 || pageNum > pdf.numPages) {
      console.warn(`Page ${pageNum} out of range, skipping`);
      continue;
    }

    const page = await pdf.getPage(pageNum);
    const imageData = await renderPageToImageData(page, scale);
    results.push(imageData);

    onProgress?.(i + 1, targetPages.length);
  }

  return results;
}

/**
 * Convert a canvas to a Blob
 *
 * @param canvas - Canvas element
 * @param format - Image format
 * @param quality - Quality for JPEG/WebP
 * @returns Blob of the image
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ImageFormat = 'png',
  quality: number = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      `image/${format}`,
      quality
    );
  });
}

/**
 * Get optimal scale for OCR based on page dimensions
 *
 * Higher DPI generally means better OCR accuracy, but also
 * slower processing. This function returns a scale that
 * targets approximately 300 DPI for typical page sizes.
 *
 * @param pageWidth - Page width in points (72 points = 1 inch)
 * @param pageHeight - Page height in points
 * @param targetDPI - Target DPI (default: 300)
 * @returns Optimal scale factor
 */
export function getOptimalOCRScale(
  pageWidth: number,
  pageHeight: number,
  targetDPI: number = 300
): number {
  // PDF points are 72 per inch
  const currentDPI = 72;
  return targetDPI / currentDPI;
}

/**
 * Extract text content from a PDF page using PDF.js
 *
 * @param page - PDF page proxy
 * @returns Extracted text content
 */
export async function extractPageText(page: PDFPageProxy): Promise<string> {
  const textContent = await page.getTextContent();
  const textItems = textContent.items as Array<{ str: string }>;
  return textItems.map((item) => item.str).join(' ');
}

/**
 * Extract text from all pages of a PDF
 *
 * @param pdf - PDF document proxy
 * @param options - Options including page selection
 * @returns Array of page texts
 */
export async function extractAllPagesText(
  pdf: PDFDocumentProxy,
  options: { pages?: number[]; onProgress?: (current: number, total: number) => void } = {}
): Promise<string[]> {
  const { pages: pageNumbers, onProgress } = options;

  const targetPages = pageNumbers ?? Array.from(
    { length: pdf.numPages },
    (_, i) => i + 1
  );

  const results: string[] = [];

  for (let i = 0; i < targetPages.length; i++) {
    const pageNum = targetPages[i]!;

    if (pageNum < 1 || pageNum > pdf.numPages) {
      results.push('');
      continue;
    }

    const page = await pdf.getPage(pageNum);
    const text = await extractPageText(page);
    results.push(text);

    onProgress?.(i + 1, targetPages.length);
  }

  return results;
}

/**
 * Check if a PDF appears to be scanned (no extractable text)
 *
 * @param pdf - PDF document proxy
 * @param samplePages - Number of pages to sample (default: 3)
 * @returns Whether the PDF appears to be scanned
 */
export async function isScannedPDF(
  pdf: PDFDocumentProxy,
  samplePages: number = 3
): Promise<boolean> {
  const pagesToCheck = Math.min(samplePages, pdf.numPages);
  let totalTextLength = 0;

  for (let i = 1; i <= pagesToCheck; i++) {
    const page = await pdf.getPage(i);
    const text = await extractPageText(page);
    totalTextLength += text.trim().length;
  }

  // If average text per page is less than 50 characters, likely scanned
  return (totalTextLength / pagesToCheck) < 50;
}
