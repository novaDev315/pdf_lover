/**
 * PDF signature functionality for @pdflover/pdf-core
 *
 * Provides visual signature stamps for PDF documents.
 * This module does not create or verify certificate-backed digital signatures.
 * All processing runs in the browser using pdf-lib.
 */

import {
  PDFDocument,
  PDFPage,
  rgb,
  degrees,
  StandardFonts,
  PDFName,
  PDFDict,
  PDFArray,
  PDFString,
} from 'pdf-lib';
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
 * Rectangle coordinates for signature placement
 */
export interface SignatureRect {
  /** X coordinate (from left edge of page) */
  x: number;
  /** Y coordinate (from bottom edge of page) */
  y: number;
  /** Width of the signature area */
  width: number;
  /** Height of the signature area */
  height: number;
}

/**
 * Signature field information
 */
export interface SignatureField {
  /** Field name */
  name: string;
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Position and size */
  rect: SignatureRect;
  /** Whether the field is signed */
  isSigned: boolean;
  /** Signer name (if signed) */
  signerName?: string;
  /** Signing date (if signed) */
  signedDate?: Date;
}

/**
 * Signature type options
 */
export type SignatureType = 'drawn' | 'typed' | 'image';

/**
 * Options for signing a PDF document
 */
export interface SignOptions {
  /** The PDF document or ArrayBuffer */
  document: PDFDocumentType | ArrayBuffer;
  /** Signature type */
  signatureType: SignatureType;
  /** Signature image data (for 'drawn' or 'image' types) */
  signatureImage?: ArrayBuffer | Uint8Array | string;
  /** Signature text (for 'typed' type) */
  signatureText?: string;
  /** Font size for typed signature */
  fontSize?: number;
  /** Color for typed signature */
  color?: string;
  /** Page number to place signature (1-indexed) */
  pageNumber: number;
  /** Position and size of signature */
  rect: SignatureRect;
  /** Signer name for metadata */
  signerName?: string;
  /** Reason for signing */
  reason?: string;
  /** Location of signing */
  location?: string;
  /** Whether to add a signature field widget */
  addField?: boolean;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for creating a signature field
 */
export interface CreateFieldOptions {
  /** The PDF document or ArrayBuffer */
  document: PDFDocumentType | ArrayBuffer;
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Position and size of the field */
  rect: SignatureRect;
  /** Field name */
  fieldName: string;
  /** Background color (hex) */
  backgroundColor?: string;
  /** Border color (hex) */
  borderColor?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Visual signature inspection result. `verified` is always false because
 * keyword metadata cannot prove document authenticity.
 */
export interface VerificationResult {
  /** Whether verification was successful */
  verified: boolean;
  /** Verification message */
  message: string;
  /** List of signatures found */
  signatures: SignatureInfo[];
}

/**
 * Information about a signature
 */
export interface SignatureInfo {
  /** Field name */
  fieldName: string;
  /** Signer name */
  signerName?: string;
  /** Signing date */
  signedDate?: Date;
  /** Signing reason */
  reason?: string;
  /** Signing location */
  location?: string;
  /** Page number */
  pageNumber: number;
  /** This record describes a PDFLover visual stamp, not a digital signature. */
  kind: 'visual-stamp';
}

/**
 * Parse hex color to RGB
 */
function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.substring(0, 2), 16) / 255,
    g: parseInt(cleanHex.substring(2, 4), 16) / 255,
    b: parseInt(cleanHex.substring(4, 6), 16) / 255,
  };
}

/**
 * Create a signature field on a PDF page
 *
 * @param options - Field creation options
 * @returns ProcessingResult with updated PDF data
 *
 * @example
 * ```typescript
 * const result = await createSignaturePlaceholder({
 *   document: pdfArrayBuffer,
 *   pageNumber: 1,
 *   rect: { x: 100, y: 100, width: 200, height: 50 },
 *   fieldName: 'Signature1',
 * });
 * ```
 */
export async function createSignaturePlaceholder(
  options: CreateFieldOptions
): Promise<ProcessingResult> {
  const {
    document,
    pageNumber,
    rect,
    fieldName,
    backgroundColor = '#FFFDE7',
    borderColor = '#FBC02D',
    placeholder = 'Click to sign',
    onProgress,
  } = options;

  const stages = ['Validating', 'Loading', 'Creating field', 'Saving'];
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
    } catch {
      return createErrorResult('CORRUPTED_PDF', 'Failed to load document', 0);
    }

    const pages = pdfDoc.getPages();
    if (pageNumber < 1 || pageNumber > pages.length) {
      return createErrorResult('PAGE_OUT_OF_RANGE', `Page ${pageNumber} does not exist`, 0);
    }

    reportProgress(1, 100);

    // Stage 2: Create signature field
    reportProgress(2, 0);

    const page = pages[pageNumber - 1]!;
    const bgColor = parseHexColor(backgroundColor);
    const bdColor = parseHexColor(borderColor);

    // Draw the signature field background
    page.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      color: rgb(bgColor.r, bgColor.g, bgColor.b),
      borderColor: rgb(bdColor.r, bdColor.g, bdColor.b),
      borderWidth: 1,
      opacity: 0.8,
    });

    // Add placeholder text
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const textWidth = font.widthOfTextAtSize(placeholder, 12);

    page.drawText(placeholder, {
      x: rect.x + (rect.width - textWidth) / 2,
      y: rect.y + rect.height / 2 - 4,
      size: 12,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Store field metadata
    const existingKeywords = pdfDoc.getKeywords() ?? '';
    const fieldInfo = {
      type: 'signatureField',
      name: fieldName,
      page: pageNumber,
      rect,
      signed: false,
    };
    const newKeywords = existingKeywords
      ? `${existingKeywords}|sig:${JSON.stringify(fieldInfo)}`
      : `sig:${JSON.stringify(fieldInfo)}`;
    pdfDoc.setKeywords([newKeywords]);

    reportProgress(2, 100);

    // Stage 3: Save document
    reportProgress(3, 0);

    pdfDoc.setProducer('PDFLover');
    pdfDoc.setModificationDate(new Date());

    const savedBytes = await pdfDoc.save();
    const savedBuffer = savedBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return createSuccessResult(savedBuffer, bytes.byteLength, savedBuffer.byteLength, 0);
  });

  if (result.success) {
    return { ...result, duration };
  }
  return { ...result, duration };
}

/**
 * Sign a PDF document with a visual signature
 *
 * @param options - Signing options
 * @returns ProcessingResult with signed PDF data
 *
 * @example
 * ```typescript
 * // Drawn signature (from canvas)
 * const result = await signPDF({
 *   document: pdfArrayBuffer,
 *   signatureType: 'drawn',
 *   signatureImage: canvasDataUrl,
 *   pageNumber: 1,
 *   rect: { x: 100, y: 100, width: 200, height: 50 },
 *   signerName: 'John Doe',
 * });
 *
 * // Typed signature
 * const result = await signPDF({
 *   document: pdfArrayBuffer,
 *   signatureType: 'typed',
 *   signatureText: 'John Doe',
 *   pageNumber: 1,
 *   rect: { x: 100, y: 100, width: 200, height: 50 },
 * });
 * ```
 */
export async function signPDF(options: SignOptions): Promise<ProcessingResult> {
  const {
    document,
    signatureType,
    signatureImage,
    signatureText,
    fontSize = 24,
    color = '#000080',
    pageNumber,
    rect,
    signerName,
    reason,
    location,
    onProgress,
  } = options;

  const stages = ['Validating', 'Loading', 'Applying signature', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    if (signatureType === 'typed' && (!signatureText || signatureText.trim().length === 0)) {
      return createErrorResult('INVALID_PDF', 'Signature text is required for typed signatures', 0);
    }

    if ((signatureType === 'drawn' || signatureType === 'image') && !signatureImage) {
      return createErrorResult('INVALID_PDF', 'Signature image is required', 0);
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
    } catch {
      return createErrorResult('CORRUPTED_PDF', 'Failed to load document', 0);
    }

    const pages = pdfDoc.getPages();
    if (pageNumber < 1 || pageNumber > pages.length) {
      return createErrorResult('PAGE_OUT_OF_RANGE', `Page ${pageNumber} does not exist`, 0);
    }

    reportProgress(1, 100);

    // Stage 2: Apply signature
    reportProgress(2, 0);

    const page = pages[pageNumber - 1]!;

    if (signatureType === 'typed') {
      // Draw typed signature
      await drawTypedSignature(pdfDoc, page, signatureText!, rect, fontSize, color);
    } else {
      // Draw image signature
      await drawImageSignature(pdfDoc, page, signatureImage!, rect);
    }

    // Add signature metadata
    const signatureInfo = {
      type: 'signature',
      signerName: signerName ?? signatureText ?? 'Unknown',
      reason,
      location,
      signedDate: new Date().toISOString(),
      pageNumber,
      rect,
    };

    const existingKeywords = pdfDoc.getKeywords() ?? '';
    const newKeywords = existingKeywords
      ? `${existingKeywords}|signed:${JSON.stringify(signatureInfo)}`
      : `signed:${JSON.stringify(signatureInfo)}`;
    pdfDoc.setKeywords([newKeywords]);

    reportProgress(2, 100);

    // Stage 3: Save document
    reportProgress(3, 0);

    pdfDoc.setProducer('PDFLover');
    pdfDoc.setModificationDate(new Date());

    const signedBytes = await pdfDoc.save();
    const signedBuffer = signedBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return createSuccessResult(signedBuffer, bytes.byteLength, signedBuffer.byteLength, 0);
  });

  if (result.success) {
    return { ...result, duration };
  }
  return { ...result, duration };
}

/**
 * Draw a typed signature on a page
 */
async function drawTypedSignature(
  pdfDoc: PDFDocument,
  page: PDFPage,
  text: string,
  rect: SignatureRect,
  fontSize: number,
  color: string
): Promise<void> {
  // Use a cursive-looking font (Helvetica-Oblique as approximation)
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const parsedColor = parseHexColor(color);

  // Calculate font size to fit the rectangle
  let actualFontSize = fontSize;
  let textWidth = font.widthOfTextAtSize(text, actualFontSize);

  // Scale down if text is too wide
  if (textWidth > rect.width * 0.9) {
    actualFontSize = (rect.width * 0.9 * actualFontSize) / textWidth;
    textWidth = font.widthOfTextAtSize(text, actualFontSize);
  }

  // Center the text in the rectangle
  const x = rect.x + (rect.width - textWidth) / 2;
  const y = rect.y + (rect.height - actualFontSize) / 2;

  page.drawText(text, {
    x,
    y,
    size: actualFontSize,
    font,
    color: rgb(parsedColor.r, parsedColor.g, parsedColor.b),
  });

  // Draw a simple line under the signature
  page.drawLine({
    start: { x: rect.x + 10, y: rect.y + 5 },
    end: { x: rect.x + rect.width - 10, y: rect.y + 5 },
    thickness: 0.5,
    color: rgb(parsedColor.r, parsedColor.g, parsedColor.b),
    opacity: 0.5,
  });
}

/**
 * Draw an image signature on a page
 */
async function drawImageSignature(
  pdfDoc: PDFDocument,
  page: PDFPage,
  imageData: ArrayBuffer | Uint8Array | string,
  rect: SignatureRect
): Promise<void> {
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

  // Detect image type and embed
  let embeddedImage: Awaited<ReturnType<PDFDocument['embedPng']>>;

  // Check PNG magic bytes
  if (imgBytes[0] === 0x89 && imgBytes[1] === 0x50) {
    embeddedImage = await pdfDoc.embedPng(imgBytes);
  } else {
    embeddedImage = await pdfDoc.embedJpg(imgBytes);
  }

  // Calculate dimensions to fit in rect while maintaining aspect ratio
  const imageAspect = embeddedImage.width / embeddedImage.height;
  const rectAspect = rect.width / rect.height;

  let drawWidth: number;
  let drawHeight: number;

  if (imageAspect > rectAspect) {
    // Image is wider than rect
    drawWidth = rect.width * 0.9;
    drawHeight = drawWidth / imageAspect;
  } else {
    // Image is taller than rect
    drawHeight = rect.height * 0.9;
    drawWidth = drawHeight * imageAspect;
  }

  // Center in rect
  const x = rect.x + (rect.width - drawWidth) / 2;
  const y = rect.y + (rect.height - drawHeight) / 2;

  page.drawImage(embeddedImage, {
    x,
    y,
    width: drawWidth,
    height: drawHeight,
  });
}

/**
 * Inspect PDFLover visual signature metadata without claiming cryptographic
 * verification.
 *
 * @param document - PDF document or ArrayBuffer
 * @returns Verification result
 */
export async function inspectVisualSignatures(
  document: PDFDocumentType | ArrayBuffer
): Promise<VerificationResult> {
  try {
    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

    const signatures = await getVisualSignatures(document);

    if (signatures.length === 0) {
      return {
        verified: false,
        message: 'No signatures found in the document',
        signatures: [],
      };
    }

    return {
      verified: false,
      message: `Found ${signatures.length} PDFLover visual signature stamp(s); no certificate was verified`,
      signatures,
    };
  } catch {
    return {
      verified: false,
      message: 'Failed to verify document signatures',
      signatures: [],
    };
  }
}

/**
 * Get PDFLover visual signature stamps from a PDF document.
 *
 * @param document - PDF document or ArrayBuffer
 * @returns Array of signature information
 */
export async function getVisualSignatures(
  document: PDFDocumentType | ArrayBuffer
): Promise<SignatureInfo[]> {
  try {
    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

    const keywords = pdfDoc.getKeywords() ?? '';
    const signatures: SignatureInfo[] = [];

    // Parse signature metadata from keywords
    const parts = keywords.split('|');
    for (const part of parts) {
      if (part.startsWith('signed:')) {
        try {
          const sigData = JSON.parse(part.slice('signed:'.length));
          signatures.push({
            fieldName: sigData.fieldName ?? `Signature_${signatures.length + 1}`,
            signerName: sigData.signerName,
            signedDate: sigData.signedDate ? new Date(sigData.signedDate) : undefined,
            reason: sigData.reason,
            location: sigData.location,
            pageNumber: sigData.pageNumber ?? 1,
            kind: 'visual-stamp',
          });
        } catch {
          // Skip invalid signature data
        }
      }
    }

    return signatures;
  } catch {
    return [];
  }
}

/**
 * Get all signature fields (both signed and unsigned) from a PDF document
 *
 * @param document - PDF document or ArrayBuffer
 * @returns Array of signature field information
 */
export async function getSignaturePlaceholders(
  document: PDFDocumentType | ArrayBuffer
): Promise<SignatureField[]> {
  try {
    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

    const keywords = pdfDoc.getKeywords() ?? '';
    const fields: SignatureField[] = [];

    // Parse field metadata from keywords
    const parts = keywords.split('|');
    for (const part of parts) {
      if (part.startsWith('sig:')) {
        try {
          const fieldData = JSON.parse(part.slice('sig:'.length));
          fields.push({
            name: fieldData.name,
            pageNumber: fieldData.page,
            rect: fieldData.rect,
            isSigned: fieldData.signed ?? false,
            signerName: fieldData.signerName,
            signedDate: fieldData.signedDate ? new Date(fieldData.signedDate) : undefined,
          });
        } catch {
          // Skip invalid field data
        }
      }
    }

    return fields;
  } catch {
    return [];
  }
}

/**
 * Check if a PDF contains PDFLover visual signature stamps.
 *
 * @param document - PDF document or ArrayBuffer
 * @returns True if the document has signatures
 */
export async function hasVisualSignatures(
  document: PDFDocumentType | ArrayBuffer
): Promise<boolean> {
  const signatures = await getVisualSignatures(document);
  return signatures.length > 0;
}
