/**
 * PDF editing operations for @pdflover/pdf-core
 * Provides annotation, drawing, and form field capabilities using pdf-lib
 */

import {
  PDFDocument,
  PDFPage,
  rgb,
  degrees,
  StandardFonts,
  PDFName,
  PDFRef,
  PDFDict,
  PDFArray,
  PDFString,
  PDFNumber,
} from 'pdf-lib';
import { loadPDFDocument, measureTime } from './utils.js';

/**
 * Helper function to safely get a page from an array
 * Returns non-null page after validation
 */
function getPageSafely(pages: PDFPage[], pageNum: number): PDFPage | null {
  if (pageNum < 1 || pageNum > pages.length) {
    return null;
  }
  return pages[pageNum - 1] ?? null;
}

/**
 * Rectangle definition for positioning elements
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Point definition for drawing paths
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Color definition (RGB values 0-1)
 */
export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Text annotation options
 */
export interface TextAnnotationOptions {
  pageNum: number;
  x: number;
  y: number;
  content: string;
  title?: string;
  color?: Color;
  fontSize?: number;
  fontFamily?: 'Helvetica' | 'Times' | 'Courier';
  isNote?: boolean;
}

/**
 * Highlight/markup annotation options
 */
export interface MarkupOptions {
  color?: Color;
  opacity?: number;
}

/**
 * Freehand drawing options
 */
export interface FreehandOptions {
  color?: Color;
  strokeWidth?: number;
  opacity?: number;
}

/**
 * Shape types supported
 */
export type ShapeType = 'rectangle' | 'circle' | 'ellipse' | 'arrow' | 'line';

/**
 * Shape drawing options
 */
export interface ShapeOptions {
  fillColor?: Color;
  strokeColor?: Color;
  strokeWidth?: number;
  opacity?: number;
  filled?: boolean;
}

/**
 * Image insertion options
 */
export interface ImageOptions {
  preserveAspectRatio?: boolean;
  opacity?: number;
  rotation?: number;
}

/**
 * Text field options
 */
export interface TextFieldOptions {
  name?: string;
  defaultValue?: string;
  fontSize?: number;
  maxLength?: number;
  multiline?: boolean;
  required?: boolean;
  readonly?: boolean;
  backgroundColor?: Color;
  borderColor?: Color;
}

/**
 * Checkbox field options
 */
export interface CheckboxOptions {
  name?: string;
  checked?: boolean;
  readonly?: boolean;
}

/**
 * Annotation metadata for tracking
 */
export interface AnnotationMetadata {
  id: string;
  type: 'text' | 'highlight' | 'underline' | 'strikethrough' | 'freehand' | 'shape' | 'image' | 'textfield' | 'checkbox';
  pageNum: number;
  rect: Rect;
  createdAt: Date;
}

/**
 * Result of an edit operation
 */
export interface EditResult {
  success: boolean;
  data?: ArrayBuffer;
  annotationId?: string;
  error?: string;
  duration: number;
}

/**
 * Convert Color to pdf-lib RGB
 */
function colorToRgb(color: Color) {
  return rgb(
    Math.max(0, Math.min(1, color.r)),
    Math.max(0, Math.min(1, color.g)),
    Math.max(0, Math.min(1, color.b))
  );
}

/**
 * Generate unique annotation ID
 */
function generateAnnotationId(): string {
  return `annot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get font from StandardFonts
 */
function getStandardFont(fontFamily: 'Helvetica' | 'Times' | 'Courier'): string {
  switch (fontFamily) {
    case 'Times':
      return StandardFonts.TimesRoman;
    case 'Courier':
      return StandardFonts.Courier;
    case 'Helvetica':
    default:
      return StandardFonts.Helvetica;
  }
}

/**
 * Add a text annotation to a PDF
 * Creates either a text note (sticky note) or freeform text on the page
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param options - Text annotation options
 * @returns EditResult with modified PDF data
 */
export async function addTextAnnotation(
  pdfData: ArrayBuffer | Uint8Array,
  options: TextAnnotationOptions
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      if (options.pageNum < 1 || options.pageNum > pages.length) {
        return { success: false, error: `Invalid page number: ${options.pageNum}` };
      }

      const page = pages[options.pageNum - 1];
      if (!page) {
        return { success: false, error: `Page ${options.pageNum} not found` };
      }
      const annotationId = generateAnnotationId();
      const color = options.color ?? { r: 0, g: 0, b: 0 };
      const fontSize = options.fontSize ?? 12;
      const fontFamily = options.fontFamily ?? 'Helvetica';

      if (options.isNote) {
        // Create a sticky note annotation
        const noteColor = options.color ?? { r: 1, g: 1, b: 0 }; // Yellow default

        // Add visual indicator for the note
        page.drawSquare({
          x: options.x,
          y: options.y,
          size: 20,
          color: colorToRgb(noteColor),
          borderColor: rgb(0.8, 0.8, 0),
          borderWidth: 1,
          opacity: 0.8,
        });

        // Add note icon indicator
        page.drawText('N', {
          x: options.x + 6,
          y: options.y + 4,
          size: 12,
          color: rgb(0, 0, 0),
        });
      } else {
        // Draw freeform text
        const font = await pdfDoc.embedFont(getStandardFont(fontFamily));

        page.drawText(options.content, {
          x: options.x,
          y: options.y,
          size: fontSize,
          font,
          color: colorToRgb(color),
        });
      }

      // Set modification date
      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
        annotationId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to add text annotation: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Add a highlight annotation to a PDF
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param pageNum - Page number (1-indexed)
 * @param rect - Rectangle to highlight
 * @param color - Highlight color (defaults to yellow)
 * @returns EditResult with modified PDF data
 */
export async function addHighlight(
  pdfData: ArrayBuffer | Uint8Array,
  pageNum: number,
  rect: Rect,
  color: Color = { r: 1, g: 1, b: 0 }
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      const page = getPageSafely(pages, pageNum);
      if (!page) {
        return { success: false, error: `Invalid page number: ${pageNum}` };
      }
      const annotationId = generateAnnotationId();

      // Draw highlight rectangle with transparency
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: colorToRgb(color),
        opacity: 0.35,
      });

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
        annotationId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to add highlight: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Add an underline annotation to a PDF
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param pageNum - Page number (1-indexed)
 * @param rect - Rectangle representing the text area to underline
 * @param options - Markup options
 * @returns EditResult with modified PDF data
 */
export async function addUnderline(
  pdfData: ArrayBuffer | Uint8Array,
  pageNum: number,
  rect: Rect,
  options: MarkupOptions = {}
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      const page = getPageSafely(pages, pageNum);
      if (!page) {
        return { success: false, error: `Invalid page number: ${pageNum}` };
      }
      const annotationId = generateAnnotationId();
      const color = options.color ?? { r: 0, g: 0, b: 0 };
      const opacity = options.opacity ?? 1;

      // Draw underline as a thin rectangle at the bottom of the text area
      page.drawLine({
        start: { x: rect.x, y: rect.y },
        end: { x: rect.x + rect.width, y: rect.y },
        thickness: 1,
        color: colorToRgb(color),
        opacity,
      });

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
        annotationId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to add underline: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Add a strikethrough annotation to a PDF
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param pageNum - Page number (1-indexed)
 * @param rect - Rectangle representing the text area to strike through
 * @param options - Markup options
 * @returns EditResult with modified PDF data
 */
export async function addStrikethrough(
  pdfData: ArrayBuffer | Uint8Array,
  pageNum: number,
  rect: Rect,
  options: MarkupOptions = {}
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      const page = getPageSafely(pages, pageNum);
      if (!page) {
        return { success: false, error: `Invalid page number: ${pageNum}` };
      }
      const annotationId = generateAnnotationId();
      const color = options.color ?? { r: 1, g: 0, b: 0 };
      const opacity = options.opacity ?? 1;

      // Draw strikethrough line through the middle of the text area
      const middleY = rect.y + rect.height / 2;

      page.drawLine({
        start: { x: rect.x, y: middleY },
        end: { x: rect.x + rect.width, y: middleY },
        thickness: 1.5,
        color: colorToRgb(color),
        opacity,
      });

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
        annotationId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to add strikethrough: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Add freehand drawing to a PDF
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param pageNum - Page number (1-indexed)
 * @param paths - Array of paths, each path is an array of points
 * @param options - Drawing options
 * @returns EditResult with modified PDF data
 */
export async function addFreehandDrawing(
  pdfData: ArrayBuffer | Uint8Array,
  pageNum: number,
  paths: Point[][],
  options: FreehandOptions = {}
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      const page = getPageSafely(pages, pageNum);
      if (!page) {
        return { success: false, error: `Invalid page number: ${pageNum}` };
      }
      const annotationId = generateAnnotationId();
      const color = options.color ?? { r: 0, g: 0, b: 0 };
      const strokeWidth = options.strokeWidth ?? 2;
      const opacity = options.opacity ?? 1;

      // Draw each path as connected line segments
      for (const path of paths) {
        if (path.length < 2) continue;

        for (let i = 0; i < path.length - 1; i++) {
          const start = path[i];
          const end = path[i + 1];

          page.drawLine({
            start: { x: start.x, y: start.y },
            end: { x: end.x, y: end.y },
            thickness: strokeWidth,
            color: colorToRgb(color),
            opacity,
            lineCap: 1, // Round cap for smoother appearance
          });
        }
      }

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
        annotationId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to add freehand drawing: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Add a shape to a PDF
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param pageNum - Page number (1-indexed)
 * @param shapeType - Type of shape to draw
 * @param rect - Bounding rectangle for the shape
 * @param options - Shape options
 * @returns EditResult with modified PDF data
 */
export async function addShape(
  pdfData: ArrayBuffer | Uint8Array,
  pageNum: number,
  shapeType: ShapeType,
  rect: Rect,
  options: ShapeOptions = {}
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      const page = getPageSafely(pages, pageNum);
      if (!page) {
        return { success: false, error: `Invalid page number: ${pageNum}` };
      }
      const annotationId = generateAnnotationId();
      const strokeColor = options.strokeColor ?? { r: 0, g: 0, b: 0 };
      const fillColor = options.fillColor ?? { r: 1, g: 1, b: 1 };
      const strokeWidth = options.strokeWidth ?? 2;
      const opacity = options.opacity ?? 1;
      const filled = options.filled ?? false;

      switch (shapeType) {
        case 'rectangle':
          page.drawRectangle({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            borderColor: colorToRgb(strokeColor),
            borderWidth: strokeWidth,
            color: filled ? colorToRgb(fillColor) : undefined,
            opacity: filled ? opacity : undefined,
            borderOpacity: opacity,
          });
          break;

        case 'circle': {
          const radius = Math.min(rect.width, rect.height) / 2;
          const centerX = rect.x + rect.width / 2;
          const centerY = rect.y + rect.height / 2;

          page.drawCircle({
            x: centerX,
            y: centerY,
            size: radius,
            borderColor: colorToRgb(strokeColor),
            borderWidth: strokeWidth,
            color: filled ? colorToRgb(fillColor) : undefined,
            opacity: filled ? opacity : undefined,
            borderOpacity: opacity,
          });
          break;
        }

        case 'ellipse': {
          const centerX = rect.x + rect.width / 2;
          const centerY = rect.y + rect.height / 2;

          page.drawEllipse({
            x: centerX,
            y: centerY,
            xScale: rect.width / 2,
            yScale: rect.height / 2,
            borderColor: colorToRgb(strokeColor),
            borderWidth: strokeWidth,
            color: filled ? colorToRgb(fillColor) : undefined,
            opacity: filled ? opacity : undefined,
            borderOpacity: opacity,
          });
          break;
        }

        case 'line':
          page.drawLine({
            start: { x: rect.x, y: rect.y },
            end: { x: rect.x + rect.width, y: rect.y + rect.height },
            thickness: strokeWidth,
            color: colorToRgb(strokeColor),
            opacity,
          });
          break;

        case 'arrow': {
          // Draw main line
          const startX = rect.x;
          const startY = rect.y;
          const endX = rect.x + rect.width;
          const endY = rect.y + rect.height;

          page.drawLine({
            start: { x: startX, y: startY },
            end: { x: endX, y: endY },
            thickness: strokeWidth,
            color: colorToRgb(strokeColor),
            opacity,
          });

          // Draw arrowhead
          const arrowLength = 15;
          const arrowAngle = Math.PI / 6; // 30 degrees
          const angle = Math.atan2(endY - startY, endX - startX);

          const arrow1X = endX - arrowLength * Math.cos(angle - arrowAngle);
          const arrow1Y = endY - arrowLength * Math.sin(angle - arrowAngle);
          const arrow2X = endX - arrowLength * Math.cos(angle + arrowAngle);
          const arrow2Y = endY - arrowLength * Math.sin(angle + arrowAngle);

          page.drawLine({
            start: { x: endX, y: endY },
            end: { x: arrow1X, y: arrow1Y },
            thickness: strokeWidth,
            color: colorToRgb(strokeColor),
            opacity,
          });

          page.drawLine({
            start: { x: endX, y: endY },
            end: { x: arrow2X, y: arrow2Y },
            thickness: strokeWidth,
            color: colorToRgb(strokeColor),
            opacity,
          });
          break;
        }
      }

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
        annotationId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to add shape: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Add an image to a PDF
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param pageNum - Page number (1-indexed)
 * @param imageData - Image data as ArrayBuffer, Uint8Array, or base64 string
 * @param rect - Rectangle for positioning the image
 * @param options - Image options
 * @returns EditResult with modified PDF data
 */
export async function addImage(
  pdfData: ArrayBuffer | Uint8Array,
  pageNum: number,
  imageData: ArrayBuffer | Uint8Array | string,
  rect: Rect,
  options: ImageOptions = {}
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      const page = getPageSafely(pages, pageNum);
      if (!page) {
        return { success: false, error: `Invalid page number: ${pageNum}` };
      }
      const annotationId = generateAnnotationId();

      // Convert image data to Uint8Array if needed
      let imageBytes: Uint8Array;
      if (typeof imageData === 'string') {
        // Assume base64 string
        const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');
        const binaryString = atob(base64);
        imageBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          imageBytes[i] = binaryString.charCodeAt(i);
        }
      } else if (imageData instanceof ArrayBuffer) {
        imageBytes = new Uint8Array(imageData);
      } else {
        imageBytes = imageData;
      }

      // Detect image type and embed
      let embeddedImage;
      const isPng =
        imageBytes[0] === 0x89 &&
        imageBytes[1] === 0x50 &&
        imageBytes[2] === 0x4e &&
        imageBytes[3] === 0x47;

      if (isPng) {
        embeddedImage = await pdfDoc.embedPng(imageBytes);
      } else {
        // Assume JPEG
        embeddedImage = await pdfDoc.embedJpg(imageBytes);
      }

      // Calculate dimensions
      let drawWidth = rect.width;
      let drawHeight = rect.height;

      if (options.preserveAspectRatio !== false) {
        const imageAspect = embeddedImage.width / embeddedImage.height;
        const rectAspect = rect.width / rect.height;

        if (imageAspect > rectAspect) {
          drawHeight = rect.width / imageAspect;
        } else {
          drawWidth = rect.height * imageAspect;
        }
      }

      // Calculate centered position
      const drawX = rect.x + (rect.width - drawWidth) / 2;
      const drawY = rect.y + (rect.height - drawHeight) / 2;

      page.drawImage(embeddedImage, {
        x: drawX,
        y: drawY,
        width: drawWidth,
        height: drawHeight,
        opacity: options.opacity ?? 1,
        rotate: options.rotation ? degrees(options.rotation) : undefined,
      });

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
        annotationId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to add image: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Add a text field to a PDF form
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param pageNum - Page number (1-indexed)
 * @param rect - Rectangle for the text field
 * @param options - Text field options
 * @returns EditResult with modified PDF data
 */
export async function addTextField(
  pdfData: ArrayBuffer | Uint8Array,
  pageNum: number,
  rect: Rect,
  options: TextFieldOptions = {}
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      const page = getPageSafely(pages, pageNum);
      if (!page) {
        return { success: false, error: `Invalid page number: ${pageNum}` };
      }
      const form = pdfDoc.getForm();
      const annotationId = generateAnnotationId();
      const fieldName = options.name ?? `textfield_${annotationId}`;

      // Create text field
      const textField = form.createTextField(fieldName);
      textField.addToPage(page, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        borderWidth: 1,
        backgroundColor: options.backgroundColor
          ? colorToRgb(options.backgroundColor)
          : rgb(1, 1, 1),
        borderColor: options.borderColor
          ? colorToRgb(options.borderColor)
          : rgb(0, 0, 0),
      });

      if (options.defaultValue) {
        textField.setText(options.defaultValue);
      }

      if (options.maxLength) {
        textField.setMaxLength(options.maxLength);
      }

      if (options.multiline) {
        textField.enableMultiline();
      }

      if (options.required) {
        textField.enableRequired();
      }

      if (options.readonly) {
        textField.enableReadOnly();
      }

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
        annotationId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to add text field: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Add a checkbox to a PDF form
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param pageNum - Page number (1-indexed)
 * @param rect - Rectangle for the checkbox
 * @param options - Checkbox options
 * @returns EditResult with modified PDF data
 */
export async function addCheckbox(
  pdfData: ArrayBuffer | Uint8Array,
  pageNum: number,
  rect: Rect,
  options: CheckboxOptions = {}
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      const page = getPageSafely(pages, pageNum);
      if (!page) {
        return { success: false, error: `Invalid page number: ${pageNum}` };
      }
      const form = pdfDoc.getForm();
      const annotationId = generateAnnotationId();
      const fieldName = options.name ?? `checkbox_${annotationId}`;

      // Create checkbox
      const checkbox = form.createCheckBox(fieldName);
      checkbox.addToPage(page, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        borderWidth: 1,
        borderColor: rgb(0, 0, 0),
        backgroundColor: rgb(1, 1, 1),
      });

      if (options.checked) {
        checkbox.check();
      }

      if (options.readonly) {
        checkbox.enableReadOnly();
      }

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
        annotationId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to add checkbox: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Remove an annotation from a PDF
 * Note: This is a simplified implementation that removes visible content
 * True annotation removal requires parsing the PDF annotation dictionary
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param pageNum - Page number (1-indexed)
 * @param rect - Rectangle area to clear (cover with white)
 * @returns EditResult with modified PDF data
 */
export async function removeAnnotation(
  pdfData: ArrayBuffer | Uint8Array,
  pageNum: number,
  rect: Rect
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      const page = getPageSafely(pages, pageNum);
      if (!page) {
        return { success: false, error: `Invalid page number: ${pageNum}` };
      }

      // Cover the area with white rectangle
      // Note: This is a visual removal, not true annotation removal
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: rgb(1, 1, 1),
        opacity: 1,
      });

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to remove annotation: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Flatten all form fields in a PDF
 * This makes the form fields non-editable and part of the page content
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @returns EditResult with modified PDF data
 */
export async function flattenForm(
  pdfData: ArrayBuffer | Uint8Array
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const form = pdfDoc.getForm();

      form.flatten();

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to flatten form: ${message}` };
    }
  });

  return { ...result, duration };
}
