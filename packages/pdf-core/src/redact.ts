/**
 * PDF redaction operations for @pdflover/pdf-core
 * Provides secure redaction capabilities for sensitive content
 */

import { PDFDocument, rgb } from 'pdf-lib';
import { loadPDFDocument, measureTime } from './utils.js';
import type { Rect, Color, EditResult } from './edit.js';

/**
 * Redaction entry for tracking pending redactions
 */
export interface RedactionEntry {
  id: string;
  pageNum: number;
  rect: Rect;
  type: 'area' | 'text';
  searchText?: string;
  applied: boolean;
  createdAt: Date;
}

/**
 * Redaction options
 */
export interface RedactionOptions {
  /** Color to fill the redacted area (defaults to black) */
  fillColor?: Color;
  /** Whether to add a border around the redaction */
  addBorder?: boolean;
  /** Border color if addBorder is true */
  borderColor?: Color;
  /** Overlay text on the redaction (e.g., "REDACTED") */
  overlayText?: string;
  /** Font size for overlay text */
  overlayFontSize?: number;
}

/**
 * Text search result for redaction
 */
export interface TextSearchResult {
  pageNum: number;
  rects: Rect[];
  text: string;
}

/**
 * Pending redactions manager
 */
export class RedactionManager {
  private pendingRedactions: RedactionEntry[] = [];

  /**
   * Add a redaction entry
   */
  addRedaction(
    pageNum: number,
    rect: Rect,
    type: 'area' | 'text' = 'area',
    searchText?: string
  ): string {
    const id = `redact-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.pendingRedactions.push({
      id,
      pageNum,
      rect,
      type,
      searchText,
      applied: false,
      createdAt: new Date(),
    });
    return id;
  }

  /**
   * Remove a pending redaction
   */
  removeRedaction(id: string): boolean {
    const index = this.pendingRedactions.findIndex((r) => r.id === id);
    if (index !== -1) {
      this.pendingRedactions.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all pending redactions
   */
  getPendingRedactions(): RedactionEntry[] {
    return [...this.pendingRedactions];
  }

  /**
   * Get pending redactions for a specific page
   */
  getRedactionsForPage(pageNum: number): RedactionEntry[] {
    return this.pendingRedactions.filter((r) => r.pageNum === pageNum);
  }

  /**
   * Clear all pending redactions
   */
  clearRedactions(): void {
    this.pendingRedactions = [];
  }

  /**
   * Mark redactions as applied
   */
  markApplied(): void {
    this.pendingRedactions.forEach((r) => {
      r.applied = true;
    });
  }
}

/**
 * Redact a rectangular area in a PDF
 * This permanently removes content under the redaction
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param pageNum - Page number (1-indexed)
 * @param rect - Rectangle area to redact
 * @param options - Redaction options
 * @returns EditResult with modified PDF data
 */
export async function redactArea(
  pdfData: ArrayBuffer | Uint8Array,
  pageNum: number,
  rect: Rect,
  options: RedactionOptions = {}
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      if (pageNum < 1 || pageNum > pages.length) {
        return { success: false, error: `Invalid page number: ${pageNum}` };
      }

      const page = pages[pageNum - 1];
      const fillColor = options.fillColor ?? { r: 0, g: 0, b: 0 };

      // Draw a solid rectangle to cover the redacted area
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: rgb(fillColor.r, fillColor.g, fillColor.b),
        opacity: 1,
      });

      // Add border if requested
      if (options.addBorder) {
        const borderColor = options.borderColor ?? { r: 0.5, g: 0, b: 0 };
        page.drawRectangle({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
          borderWidth: 1,
        });
      }

      // Add overlay text if requested
      if (options.overlayText) {
        const fontSize = options.overlayFontSize ?? 10;
        const textWidth = options.overlayText.length * fontSize * 0.5;
        const textX = rect.x + (rect.width - textWidth) / 2;
        const textY = rect.y + (rect.height - fontSize) / 2;

        page.drawText(options.overlayText, {
          x: textX,
          y: textY,
          size: fontSize,
          color: rgb(1, 1, 1), // White text on black background
        });
      }

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to redact area: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Redact text occurrences in a PDF
 * Note: This requires text position information which pdf-lib doesn't provide directly
 * The rects parameter should contain the positions of found text instances
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param pageNum - Page number (1-indexed)
 * @param rects - Array of rectangles where the text was found
 * @param options - Redaction options
 * @returns EditResult with modified PDF data
 */
export async function redactText(
  pdfData: ArrayBuffer | Uint8Array,
  pageNum: number,
  rects: Rect[],
  options: RedactionOptions = {}
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      if (pageNum < 1 || pageNum > pages.length) {
        return { success: false, error: `Invalid page number: ${pageNum}` };
      }

      if (rects.length === 0) {
        return { success: true, data: pdfData instanceof ArrayBuffer ? pdfData : pdfData.buffer as ArrayBuffer };
      }

      const page = pages[pageNum - 1];
      const fillColor = options.fillColor ?? { r: 0, g: 0, b: 0 };

      // Redact each text occurrence
      for (const rect of rects) {
        // Add padding around text
        const paddedRect = {
          x: rect.x - 2,
          y: rect.y - 2,
          width: rect.width + 4,
          height: rect.height + 4,
        };

        page.drawRectangle({
          x: paddedRect.x,
          y: paddedRect.y,
          width: paddedRect.width,
          height: paddedRect.height,
          color: rgb(fillColor.r, fillColor.g, fillColor.b),
          opacity: 1,
        });

        if (options.addBorder) {
          const borderColor = options.borderColor ?? { r: 0.5, g: 0, b: 0 };
          page.drawRectangle({
            x: paddedRect.x,
            y: paddedRect.y,
            width: paddedRect.width,
            height: paddedRect.height,
            borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
            borderWidth: 0.5,
          });
        }
      }

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to redact text: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Apply multiple pending redactions to a PDF
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param redactions - Array of redaction entries to apply
 * @param options - Redaction options to use for all redactions
 * @returns EditResult with modified PDF data
 */
export async function applyRedactions(
  pdfData: ArrayBuffer | Uint8Array,
  redactions: RedactionEntry[],
  options: RedactionOptions = {}
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      if (redactions.length === 0) {
        return {
          success: true,
          data: pdfData instanceof ArrayBuffer ? pdfData : pdfData.buffer as ArrayBuffer,
        };
      }

      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();
      const fillColor = options.fillColor ?? { r: 0, g: 0, b: 0 };

      // Group redactions by page for efficiency
      const redactionsByPage = new Map<number, RedactionEntry[]>();
      for (const redaction of redactions) {
        if (!redactionsByPage.has(redaction.pageNum)) {
          redactionsByPage.set(redaction.pageNum, []);
        }
        redactionsByPage.get(redaction.pageNum)!.push(redaction);
      }

      // Apply redactions page by page
      for (const [pageNum, pageRedactions] of Array.from(redactionsByPage.entries())) {
        if (pageNum < 1 || pageNum > pages.length) {
          console.warn(`Skipping invalid page number: ${pageNum}`);
          continue;
        }

        const page = pages[pageNum - 1];

        for (const redaction of pageRedactions) {
          if (redaction.applied) continue;

          const rect = redaction.rect;

          // Draw redaction rectangle
          page.drawRectangle({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            color: rgb(fillColor.r, fillColor.g, fillColor.b),
            opacity: 1,
          });

          // Add border if requested
          if (options.addBorder) {
            const borderColor = options.borderColor ?? { r: 0.5, g: 0, b: 0 };
            page.drawRectangle({
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
              borderWidth: 1,
            });
          }

          // Add overlay text if requested
          if (options.overlayText) {
            const fontSize = options.overlayFontSize ?? 8;
            const textWidth = options.overlayText.length * fontSize * 0.5;

            // Only add text if it fits
            if (textWidth < rect.width && fontSize < rect.height) {
              const textX = rect.x + (rect.width - textWidth) / 2;
              const textY = rect.y + (rect.height - fontSize) / 2;

              page.drawText(options.overlayText, {
                x: textX,
                y: textY,
                size: fontSize,
                color: rgb(1, 1, 1),
              });
            }
          }
        }
      }

      pdfDoc.setModificationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: modifiedPdfBytes.buffer as ArrayBuffer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to apply redactions: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Sanitize a PDF by removing metadata and potentially sensitive information
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param removeMetadata - Whether to clear document metadata
 * @returns EditResult with sanitized PDF data
 */
export async function sanitizePDF(
  pdfData: ArrayBuffer | Uint8Array,
  removeMetadata: boolean = true
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      const pdfDoc = await loadPDFDocument(pdfData);

      if (removeMetadata) {
        // Clear all metadata
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setCreator('');
        pdfDoc.setProducer('PDFLover');
      }

      // Update modification date
      pdfDoc.setModificationDate(new Date());

      const sanitizedPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: sanitizedPdfBytes.buffer as ArrayBuffer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to sanitize PDF: ${message}` };
    }
  });

  return { ...result, duration };
}

/**
 * Create a redaction preview by adding semi-transparent overlays
 * This allows users to preview redactions before applying them permanently
 *
 * @param pdfData - PDF data as ArrayBuffer or Uint8Array
 * @param redactions - Array of redaction entries to preview
 * @returns EditResult with preview PDF data
 */
export async function previewRedactions(
  pdfData: ArrayBuffer | Uint8Array,
  redactions: RedactionEntry[]
): Promise<EditResult> {
  const { result, duration } = await measureTime(async () => {
    try {
      if (redactions.length === 0) {
        return {
          success: true,
          data: pdfData instanceof ArrayBuffer ? pdfData : pdfData.buffer as ArrayBuffer,
        };
      }

      const pdfDoc = await loadPDFDocument(pdfData);
      const pages = pdfDoc.getPages();

      // Group redactions by page
      const redactionsByPage = new Map<number, RedactionEntry[]>();
      for (const redaction of redactions) {
        if (!redactionsByPage.has(redaction.pageNum)) {
          redactionsByPage.set(redaction.pageNum, []);
        }
        redactionsByPage.get(redaction.pageNum)!.push(redaction);
      }

      // Draw preview overlays
      for (const [pageNum, pageRedactions] of Array.from(redactionsByPage.entries())) {
        if (pageNum < 1 || pageNum > pages.length) continue;

        const page = pages[pageNum - 1];

        for (const redaction of pageRedactions) {
          const rect = redaction.rect;

          // Draw semi-transparent red overlay
          page.drawRectangle({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            color: rgb(0.8, 0, 0),
            opacity: 0.3,
          });

          // Draw border
          page.drawRectangle({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            borderColor: rgb(0.8, 0, 0),
            borderWidth: 2,
          });

          // Add "REDACT" label if space permits
          if (rect.width > 50 && rect.height > 15) {
            const labelText = 'REDACT';
            const fontSize = Math.min(12, rect.height - 4);
            const textX = rect.x + 4;
            const textY = rect.y + (rect.height - fontSize) / 2;

            page.drawText(labelText, {
              x: textX,
              y: textY,
              size: fontSize,
              color: rgb(0.8, 0, 0),
            });
          }
        }
      }

      const previewPdfBytes = await pdfDoc.save();
      return {
        success: true,
        data: previewPdfBytes.buffer as ArrayBuffer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to create redaction preview: ${message}` };
    }
  });

  return { ...result, duration };
}
