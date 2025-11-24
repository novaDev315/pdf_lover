/**
 * PDF image extraction functionality for @pdflover/pdf-core
 *
 * Extracts images from PDF documents using PDF.js
 * Supports various image formats: JPEG, PNG, JBIG2, etc.
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ProgressCallback, ProgressInfo } from '@pdflover/shared';

/**
 * Extracted image information
 */
export interface ExtractedImage {
  /** Page number (1-indexed) */
  page: number;
  /** Image index on the page (0-indexed) */
  index: number;
  /** Raw image data */
  data: Uint8Array;
  /** Image format (jpeg, png, etc.) */
  format: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Original object name in PDF */
  objectName?: string;
  /** Bits per component */
  bitsPerComponent?: number;
  /** Color space type */
  colorSpace?: string;
}

/**
 * Image metadata without raw data
 */
export interface ImageMetadata {
  /** Page number (1-indexed) */
  page: number;
  /** Image index on the page (0-indexed) */
  index: number;
  /** Image format (jpeg, png, etc.) */
  format: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Estimated size in bytes */
  estimatedSize: number;
  /** Bits per component */
  bitsPerComponent?: number;
  /** Color space type */
  colorSpace?: string;
}

/**
 * Options for image extraction
 */
export interface ExtractImagesOptions {
  /** Specific pages to extract from (1-indexed), defaults to all pages */
  pages?: number[];
  /** Minimum width for images (filters out small images) */
  minWidth?: number;
  /** Minimum height for images (filters out small images) */
  minHeight?: number;
  /** Output format conversion (keep original if not specified) */
  outputFormat?: 'original' | 'png' | 'jpeg' | 'webp';
  /** Quality for lossy formats (0-1, default 0.92) */
  quality?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Result of image extraction
 */
export interface ExtractImagesResult {
  /** Whether extraction was successful */
  success: boolean;
  /** Extracted images */
  images: ExtractedImage[];
  /** Total number of images found */
  totalFound: number;
  /** Number of images after filtering */
  totalExtracted: number;
  /** Processing duration in ms */
  duration: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Result of image count operation
 */
export interface ImageCountResult {
  /** Total images across all pages */
  total: number;
  /** Images per page */
  perPage: { page: number; count: number }[];
}

/**
 * Filter type for DCTDecode (JPEG)
 */
const FILTER_DCTDECODE = 'DCTDecode';

/**
 * Filter type for FlateDecode (PNG-like)
 */
const FILTER_FLATEDECODE = 'FlateDecode';

/**
 * Filter type for JBIG2
 */
const FILTER_JBIG2DECODE = 'JBIG2Decode';

/**
 * Filter type for JPX (JPEG2000)
 */
const FILTER_JPXDECODE = 'JPXDecode';

/**
 * Detect image format from PDF filter
 */
function getFormatFromFilter(filter: string | string[]): string {
  const filterName = Array.isArray(filter) ? filter[0] : filter;

  switch (filterName) {
    case FILTER_DCTDECODE:
      return 'jpeg';
    case FILTER_JPXDECODE:
      return 'jp2';
    case FILTER_JBIG2DECODE:
      return 'jbig2';
    case FILTER_FLATEDECODE:
    default:
      return 'png';
  }
}

/**
 * Get MIME type from format
 */
function getMimeType(format: string): string {
  switch (format) {
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'jp2':
      return 'image/jp2';
    case 'jbig2':
      return 'image/x-jbig2';
    default:
      return 'image/png';
  }
}

/**
 * Convert raw image data to canvas ImageData
 */
function createImageData(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  colorSpace: string,
  bitsPerComponent: number
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not create canvas context');
  }

  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data;

  if (colorSpace === 'DeviceRGB' || colorSpace === 'RGB') {
    // RGB data - copy with alpha channel
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      pixels[j] = data[i]!;     // R
      pixels[j + 1] = data[i + 1]!; // G
      pixels[j + 2] = data[i + 2]!; // B
      pixels[j + 3] = 255;     // A
    }
  } else if (colorSpace === 'DeviceGray' || colorSpace === 'Gray' || colorSpace === 'G') {
    // Grayscale data
    for (let i = 0, j = 0; i < data.length; i++, j += 4) {
      const gray = data[i]!;
      pixels[j] = gray;     // R
      pixels[j + 1] = gray; // G
      pixels[j + 2] = gray; // B
      pixels[j + 3] = 255;  // A
    }
  } else if (colorSpace === 'DeviceCMYK' || colorSpace === 'CMYK') {
    // CMYK data - convert to RGB
    for (let i = 0, j = 0; i < data.length; i += 4, j += 4) {
      const c = data[i]! / 255;
      const m = data[i + 1]! / 255;
      const y = data[i + 2]! / 255;
      const k = data[i + 3]! / 255;

      pixels[j] = Math.round(255 * (1 - c) * (1 - k));     // R
      pixels[j + 1] = Math.round(255 * (1 - m) * (1 - k)); // G
      pixels[j + 2] = Math.round(255 * (1 - y) * (1 - k)); // B
      pixels[j + 3] = 255;                                  // A
    }
  } else {
    // Assume RGB-like data
    const componentsPerPixel = data.length / (width * height);
    if (componentsPerPixel >= 3) {
      for (let i = 0, j = 0; i < data.length; i += componentsPerPixel, j += 4) {
        pixels[j] = data[i]!;
        pixels[j + 1] = data[i + 1]!;
        pixels[j + 2] = data[i + 2]!;
        pixels[j + 3] = 255;
      }
    } else {
      // Single component - treat as grayscale
      for (let i = 0, j = 0; i < data.length; i++, j += 4) {
        const gray = data[i]!;
        pixels[j] = gray;
        pixels[j + 1] = gray;
        pixels[j + 2] = gray;
        pixels[j + 3] = 255;
      }
    }
  }

  return imageData;
}

/**
 * Convert ImageData to specified format
 */
async function convertImageData(
  imageData: ImageData,
  format: string,
  quality: number
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not create canvas context');
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          blob.arrayBuffer().then((buffer) => {
            resolve(new Uint8Array(buffer));
          }).catch(reject);
        } else {
          reject(new Error('Failed to convert image'));
        }
      },
      getMimeType(format),
      quality
    );
  });
}

/**
 * Extract image objects from a PDF page
 */
async function extractImagesFromPage(
  page: any,
  pageNumber: number,
  options: ExtractImagesOptions
): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];
  const { minWidth = 0, minHeight = 0, outputFormat = 'original', quality = 0.92 } = options;

  try {
    const operatorList = await page.getOperatorList();
    const objs = page.objs;

    // Track processed images to avoid duplicates
    const processedImages = new Set<string>();

    for (let i = 0; i < operatorList.fnArray.length; i++) {
      const fn = operatorList.fnArray[i];

      // OPS.paintImageXObject = 85
      // OPS.paintImageXObjectRepeat = 88
      // OPS.paintJpegXObject = 82
      if (fn === 85 || fn === 88 || fn === 82) {
        const imgName = operatorList.argsArray[i]?.[0];

        if (!imgName || processedImages.has(imgName)) {
          continue;
        }

        processedImages.add(imgName);

        try {
          // Get the image object
          const imgData = await new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
            objs.get(imgName, (data: any) => {
              clearTimeout(timeout);
              resolve(data);
            });
          });

          if (!imgData) continue;

          const width = imgData.width || 0;
          const height = imgData.height || 0;

          // Apply size filters
          if (width < minWidth || height < minHeight) {
            continue;
          }

          // Determine format from filter
          let format = 'png';
          if (imgData.filter) {
            format = getFormatFromFilter(imgData.filter);
          }

          // Get raw image data
          let imageBytes: Uint8Array;

          if (imgData.data && imgData.data instanceof Uint8ClampedArray) {
            // Already decoded image data (RGBA)
            const imageData = new ImageData(imgData.data, width, height);
            const targetFormat = outputFormat === 'original' ? 'png' : outputFormat;
            imageBytes = await convertImageData(imageData, targetFormat, quality);
            format = targetFormat;
          } else if (imgData.bitmap) {
            // ImageBitmap - render to canvas
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(imgData.bitmap, 0, 0);
              const targetFormat = outputFormat === 'original' ? 'png' : outputFormat;
              const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                  (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
                  getMimeType(targetFormat),
                  quality
                );
              });
              imageBytes = new Uint8Array(await blob.arrayBuffer());
              format = targetFormat;
            } else {
              continue;
            }
          } else if (imgData.src) {
            // JPEG data stored directly
            imageBytes = new Uint8Array(imgData.src);
            format = 'jpeg';

            // Convert if needed
            if (outputFormat !== 'original' && outputFormat !== 'jpeg') {
              const img = await createImageFromBytes(imageBytes, 'image/jpeg');
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                const blob = await new Promise<Blob>((resolve, reject) => {
                  canvas.toBlob(
                    (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
                    getMimeType(outputFormat),
                    quality
                  );
                });
                imageBytes = new Uint8Array(await blob.arrayBuffer());
                format = outputFormat;
              }
            }
          } else {
            // Raw pixel data - needs reconstruction
            const colorSpace = imgData.colorSpace?.name || 'DeviceRGB';
            const bitsPerComponent = imgData.bitsPerComponent || 8;

            if (imgData.data) {
              const imageData = createImageData(
                imgData.data,
                width,
                height,
                colorSpace,
                bitsPerComponent
              );
              const targetFormat = outputFormat === 'original' ? 'png' : outputFormat;
              imageBytes = await convertImageData(imageData, targetFormat, quality);
              format = targetFormat;
            } else {
              continue;
            }
          }

          images.push({
            page: pageNumber,
            index: images.length,
            data: imageBytes,
            format,
            width,
            height,
            objectName: imgName,
            bitsPerComponent: imgData.bitsPerComponent,
            colorSpace: imgData.colorSpace?.name,
          });
        } catch {
          // Skip problematic images
          continue;
        }
      }
    }
  } catch {
    // Page processing error - return empty
  }

  return images;
}

/**
 * Create an Image element from bytes
 */
async function createImageFromBytes(bytes: Uint8Array, mimeType: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // Ensure we have a regular ArrayBuffer, not SharedArrayBuffer
    const regularBytes = new Uint8Array(bytes);
    const blob = new Blob([regularBytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Extract all images from a PDF document
 *
 * @param pdf - PDF.js document proxy
 * @param options - Extraction options
 * @returns Promise with extraction result
 *
 * @example
 * ```typescript
 * const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
 * const result = await extractImages(pdf, {
 *   minWidth: 100,
 *   minHeight: 100,
 *   outputFormat: 'png',
 *   onProgress: (info) => console.log(info.percentage),
 * });
 * console.log(`Extracted ${result.images.length} images`);
 * ```
 */
export async function extractImages(
  pdf: PDFDocumentProxy,
  options: ExtractImagesOptions = {}
): Promise<ExtractImagesResult> {
  const startTime = performance.now();
  const { pages, onProgress } = options;

  try {
    const numPages = pdf.numPages;
    const pagesToProcess = pages ?? Array.from({ length: numPages }, (_, i) => i + 1);
    const allImages: ExtractedImage[] = [];
    let totalFound = 0;

    for (let i = 0; i < pagesToProcess.length; i++) {
      const pageNum = pagesToProcess[i]!;

      if (pageNum < 1 || pageNum > numPages) {
        continue;
      }

      onProgress?.({
        percentage: Math.round((i / pagesToProcess.length) * 100),
        stage: `Processing page ${pageNum} of ${numPages}`,
        currentItem: i + 1,
        totalItems: pagesToProcess.length,
      });

      const page = await pdf.getPage(pageNum);
      const pageImages = await extractImagesFromPage(page, pageNum, options);

      totalFound += pageImages.length;

      // Re-index images
      for (const img of pageImages) {
        img.index = allImages.length;
        allImages.push(img);
      }
    }

    onProgress?.({
      percentage: 100,
      stage: 'Complete',
      currentItem: pagesToProcess.length,
      totalItems: pagesToProcess.length,
    });

    return {
      success: true,
      images: allImages,
      totalFound,
      totalExtracted: allImages.length,
      duration: Math.round(performance.now() - startTime),
    };
  } catch (error) {
    return {
      success: false,
      images: [],
      totalFound: 0,
      totalExtracted: 0,
      duration: Math.round(performance.now() - startTime),
      error: error instanceof Error ? error.message : 'Failed to extract images',
    };
  }
}

/**
 * Extract images as Blobs for easy download
 *
 * @param pdf - PDF.js document proxy
 * @param options - Extraction options
 * @returns Promise with array of Blobs and metadata
 *
 * @example
 * ```typescript
 * const blobs = await extractImagesAsBlobs(pdf);
 * blobs.forEach((item, i) => {
 *   downloadBlob(item.blob, `image-${i + 1}.${item.format}`);
 * });
 * ```
 */
export async function extractImagesAsBlobs(
  pdf: PDFDocumentProxy,
  options: ExtractImagesOptions = {}
): Promise<{ blob: Blob; metadata: Omit<ExtractedImage, 'data'> }[]> {
  const result = await extractImages(pdf, options);

  if (!result.success) {
    throw new Error(result.error ?? 'Failed to extract images');
  }

  return result.images.map((img) => ({
    blob: new Blob([new Uint8Array(img.data)], { type: getMimeType(img.format) }),
    metadata: {
      page: img.page,
      index: img.index,
      format: img.format,
      width: img.width,
      height: img.height,
      objectName: img.objectName,
      bitsPerComponent: img.bitsPerComponent,
      colorSpace: img.colorSpace,
    },
  }));
}

/**
 * Get count of images in a PDF without extracting them
 *
 * @param pdf - PDF.js document proxy
 * @returns Promise with image count per page and total
 *
 * @example
 * ```typescript
 * const count = await getImageCount(pdf);
 * console.log(`Total images: ${count.total}`);
 * count.perPage.forEach(({ page, count }) => {
 *   console.log(`Page ${page}: ${count} images`);
 * });
 * ```
 */
export async function getImageCount(pdf: PDFDocumentProxy): Promise<ImageCountResult> {
  const perPage: { page: number; count: number }[] = [];
  let total = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const operatorList = await page.getOperatorList();

    let pageCount = 0;
    const processedImages = new Set<string>();

    for (let j = 0; j < operatorList.fnArray.length; j++) {
      const fn = operatorList.fnArray[j];

      // OPS.paintImageXObject = 85
      // OPS.paintImageXObjectRepeat = 88
      // OPS.paintJpegXObject = 82
      if (fn === 85 || fn === 88 || fn === 82) {
        const imgName = operatorList.argsArray[j]?.[0];
        if (imgName && !processedImages.has(imgName)) {
          processedImages.add(imgName);
          pageCount++;
        }
      }
    }

    perPage.push({ page: i, count: pageCount });
    total += pageCount;
  }

  return { total, perPage };
}

/**
 * Extract image metadata without extracting the actual image data
 *
 * @param pdf - PDF.js document proxy
 * @param options - Options for filtering
 * @returns Promise with array of image metadata
 *
 * @example
 * ```typescript
 * const metadata = await extractImageMetadata(pdf);
 * metadata.forEach((img) => {
 *   console.log(`Page ${img.page}: ${img.width}x${img.height} ${img.format}`);
 * });
 * ```
 */
export async function extractImageMetadata(
  pdf: PDFDocumentProxy,
  options: Pick<ExtractImagesOptions, 'pages' | 'minWidth' | 'minHeight' | 'onProgress'> = {}
): Promise<ImageMetadata[]> {
  const { pages, minWidth = 0, minHeight = 0, onProgress } = options;
  const numPages = pdf.numPages;
  const pagesToProcess = pages ?? Array.from({ length: numPages }, (_, i) => i + 1);
  const metadata: ImageMetadata[] = [];

  for (let i = 0; i < pagesToProcess.length; i++) {
    const pageNum = pagesToProcess[i]!;

    if (pageNum < 1 || pageNum > numPages) {
      continue;
    }

    onProgress?.({
      percentage: Math.round((i / pagesToProcess.length) * 100),
      stage: `Scanning page ${pageNum}`,
      currentItem: i + 1,
      totalItems: pagesToProcess.length,
    });

    const page = await pdf.getPage(pageNum);
    const operatorList = await page.getOperatorList();
    const objs = page.objs;
    const processedImages = new Set<string>();

    for (let j = 0; j < operatorList.fnArray.length; j++) {
      const fn = operatorList.fnArray[j];

      if (fn === 85 || fn === 88 || fn === 82) {
        const imgName = operatorList.argsArray[j]?.[0];

        if (!imgName || processedImages.has(imgName)) {
          continue;
        }

        processedImages.add(imgName);

        try {
          const imgData = await new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 3000);
            objs.get(imgName, (data: any) => {
              clearTimeout(timeout);
              resolve(data);
            });
          });

          if (!imgData) continue;

          const width = imgData.width || 0;
          const height = imgData.height || 0;

          if (width < minWidth || height < minHeight) {
            continue;
          }

          let format = 'png';
          if (imgData.filter) {
            format = getFormatFromFilter(imgData.filter);
          }

          // Estimate size based on dimensions and format
          let estimatedSize = width * height * 3; // RGB
          if (format === 'jpeg') {
            estimatedSize = Math.round(estimatedSize * 0.1); // ~10% of raw
          } else if (format === 'png') {
            estimatedSize = Math.round(estimatedSize * 0.5); // ~50% of raw
          }

          metadata.push({
            page: pageNum,
            index: metadata.length,
            format,
            width,
            height,
            estimatedSize,
            bitsPerComponent: imgData.bitsPerComponent,
            colorSpace: imgData.colorSpace?.name,
          });
        } catch {
          continue;
        }
      }
    }
  }

  onProgress?.({
    percentage: 100,
    stage: 'Complete',
    currentItem: pagesToProcess.length,
    totalItems: pagesToProcess.length,
  });

  return metadata;
}

/**
 * Create a filename for an extracted image
 *
 * @param image - Extracted image or metadata
 * @param prefix - Filename prefix
 * @returns Generated filename
 */
export function createImageFilename(
  image: ExtractedImage | ImageMetadata,
  prefix = 'image'
): string {
  return `${prefix}_page${image.page}_${image.index + 1}.${image.format}`;
}
