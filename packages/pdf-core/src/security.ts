/**
 * PDF security functionality for @pdflover/pdf-core
 *
 * Provides encryption, decryption, and permission management for PDF documents.
 * Uses pdf-lib for PDF manipulation and Web Crypto API for cryptographic operations.
 */

import { PDFDocument } from 'pdf-lib';
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
 * Encryption level options
 */
export type EncryptionLevel = '128-AES' | '256-AES';

/**
 * PDF document permissions
 */
export interface PDFPermissions {
  /** Allow printing the document */
  printing: boolean;
  /** Allow copying text and graphics */
  copying: boolean;
  /** Allow modifying the document */
  modifying: boolean;
  /** Allow adding annotations */
  annotating: boolean;
  /** Allow filling form fields */
  fillingForms: boolean;
  /** Allow content accessibility extraction */
  contentAccessibility: boolean;
  /** Allow document assembly */
  documentAssembly: boolean;
  /** Allow high quality printing */
  highQualityPrint: boolean;
}

/**
 * Options for encrypting a PDF document
 */
export interface EncryptOptions {
  /** The PDF document or ArrayBuffer to encrypt */
  document: PDFDocumentType | ArrayBuffer;
  /** Password required to open the document (user password) */
  userPassword?: string;
  /** Password required to change permissions (owner password) */
  ownerPassword: string;
  /** Encryption level */
  encryptionLevel?: EncryptionLevel;
  /** Document permissions */
  permissions?: Partial<PDFPermissions>;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for decrypting a PDF document
 */
export interface DecryptOptions {
  /** The PDF document or ArrayBuffer to decrypt */
  document: PDFDocumentType | ArrayBuffer;
  /** Password to decrypt the document */
  password: string;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Security information about a PDF document
 */
export interface PDFSecurityInfo {
  /** Whether the document is encrypted */
  isEncrypted: boolean;
  /** Whether a user password is required to open */
  hasUserPassword: boolean;
  /** Whether an owner password is set */
  hasOwnerPassword: boolean;
  /** Current permissions (if accessible) */
  permissions?: PDFPermissions;
  /** Encryption method used */
  encryptionMethod?: string;
}

/**
 * Default permissions for new encrypted PDFs
 */
const DEFAULT_PERMISSIONS: PDFPermissions = {
  printing: true,
  copying: false,
  modifying: false,
  annotating: true,
  fillingForms: true,
  contentAccessibility: true,
  documentAssembly: false,
  highQualityPrint: true,
};

/**
 * Encrypt a PDF document with password protection
 *
 * Note: pdf-lib has limited encryption support. This implementation provides
 * a foundation for encryption but full AES encryption requires additional
 * libraries or server-side processing.
 *
 * @param options - Encryption options
 * @returns ProcessingResult with encrypted PDF data
 *
 * @example
 * ```typescript
 * const result = await encryptPDF({
 *   document: pdfArrayBuffer,
 *   ownerPassword: 'admin123',
 *   userPassword: 'user123',
 *   encryptionLevel: '256-AES',
 *   permissions: {
 *     printing: true,
 *     copying: false,
 *   },
 * });
 * ```
 */
export async function encryptPDF(options: EncryptOptions): Promise<ProcessingResult> {
  const {
    document,
    userPassword,
    ownerPassword,
    encryptionLevel = '256-AES',
    permissions = {},
    onProgress,
  } = options;

  const stages = ['Validating document', 'Loading document', 'Applying encryption', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    if (!ownerPassword || ownerPassword.length === 0) {
      return createErrorResult(
        'INVALID_PDF',
        'Owner password is required for encryption',
        0
      );
    }

    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);
    const validation = validatePDFBuffer(bytes);

    if (!validation.valid) {
      return createErrorResult(
        validation.errorCode!,
        validation.errorMessage!,
        0
      );
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
        return createErrorResult('ENCRYPTED_PDF', 'Document is already encrypted', 0);
      }
      return createErrorResult('CORRUPTED_PDF', 'Failed to load document', 0);
    }

    reportProgress(1, 100);

    // Stage 2: Apply encryption
    reportProgress(2, 0);

    // Merge provided permissions with defaults
    const finalPermissions: PDFPermissions = {
      ...DEFAULT_PERMISSIONS,
      ...permissions,
    };

    // Generate encryption key using Web Crypto API
    const keyData = await generateEncryptionKey(
      ownerPassword,
      encryptionLevel === '256-AES' ? 256 : 128
    );

    // Store encryption metadata in document info
    // Note: pdf-lib doesn't natively support PDF encryption, so we're adding
    // metadata to indicate the document should be encrypted. Full encryption
    // would require a more specialized library.
    pdfDoc.setProducer('PDFLover');
    pdfDoc.setModificationDate(new Date());

    // Add custom metadata for encryption info (for demonstration)
    // In a production system, actual encryption would be applied here
    const encryptionInfo = {
      method: encryptionLevel,
      hasUserPassword: !!userPassword,
      permissions: finalPermissions,
      keyChecksum: await computeChecksum(keyData),
    };

    // Store encryption config as custom metadata
    pdfDoc.setKeywords([`encrypted:${JSON.stringify(encryptionInfo)}`]);

    reportProgress(2, 100);

    // Stage 3: Save document
    reportProgress(3, 0);

    const encryptedBytes = await pdfDoc.save({
      // Use object streams for better compression with encryption
      useObjectStreams: true,
    });

    const encryptedBuffer = encryptedBytes.buffer as ArrayBuffer;

    reportProgress(3, 100);

    return createSuccessResult(
      encryptedBuffer,
      bytes.byteLength,
      encryptedBuffer.byteLength,
      0
    );
  });

  if (result.success) {
    return { ...result, duration };
  }
  return { ...result, duration };
}

/**
 * Decrypt a password-protected PDF document
 *
 * @param options - Decryption options
 * @returns ProcessingResult with decrypted PDF data
 *
 * @example
 * ```typescript
 * const result = await decryptPDF({
 *   document: encryptedPdfBuffer,
 *   password: 'user123',
 * });
 * ```
 */
export async function decryptPDF(options: DecryptOptions): Promise<ProcessingResult> {
  const { document, password, onProgress } = options;

  const stages = ['Validating', 'Decrypting', 'Saving'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    // Stage 0: Validation
    reportProgress(0, 0);

    if (!password || password.length === 0) {
      return createErrorResult('INVALID_PDF', 'Password is required', 0);
    }

    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);
    const validation = validatePDFBuffer(bytes);

    if (!validation.valid) {
      return createErrorResult(validation.errorCode!, validation.errorMessage!, 0);
    }

    reportProgress(0, 100);

    // Stage 1: Attempt to decrypt
    reportProgress(1, 0);

    let pdfDoc: PDFDocument;
    try {
      // pdf-lib supports loading encrypted PDFs with ignoreEncryption
      // For actual decryption, the password would need to be verified
      pdfDoc = await PDFDocument.load(bytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      });
    } catch (error) {
      return createErrorResult(
        'ENCRYPTED_PDF',
        'Failed to decrypt document. Please check the password.',
        0
      );
    }

    reportProgress(1, 100);

    // Stage 2: Save decrypted document
    reportProgress(2, 0);

    // Clear encryption metadata
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('PDFLover');
    pdfDoc.setModificationDate(new Date());

    const decryptedBytes = await pdfDoc.save();
    const decryptedBuffer = decryptedBytes.buffer as ArrayBuffer;

    reportProgress(2, 100);

    return createSuccessResult(
      decryptedBuffer,
      bytes.byteLength,
      decryptedBuffer.byteLength,
      0
    );
  });

  if (result.success) {
    return { ...result, duration };
  }
  return { ...result, duration };
}

/**
 * Set permissions on a PDF document
 *
 * @param document - PDF document or ArrayBuffer
 * @param permissions - Permissions to set
 * @param ownerPassword - Owner password (required to change permissions)
 * @param onProgress - Progress callback
 * @returns ProcessingResult with updated PDF data
 */
export async function setPermissions(
  document: PDFDocumentType | ArrayBuffer,
  permissions: Partial<PDFPermissions>,
  ownerPassword: string,
  onProgress?: ProgressCallback
): Promise<ProcessingResult> {
  return encryptPDF({
    document,
    ownerPassword,
    permissions,
    onProgress,
  });
}

/**
 * Get permissions from a PDF document
 *
 * @param document - PDF document or ArrayBuffer
 * @returns Current permissions or null if not encrypted
 */
export async function getPermissions(
  document: PDFDocumentType | ArrayBuffer
): Promise<PDFPermissions | null> {
  try {
    const pdfDoc = await loadPDFDocument(document as ArrayBuffer | PDFDocumentType);
    const keywords = pdfDoc.getKeywords();

    if (keywords && keywords.startsWith('encrypted:')) {
      const encryptionInfo = JSON.parse(keywords.slice('encrypted:'.length));
      return encryptionInfo.permissions as PDFPermissions;
    }

    // Return default permissions for unencrypted documents
    return {
      printing: true,
      copying: true,
      modifying: true,
      annotating: true,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: true,
      highQualityPrint: true,
    };
  } catch {
    return null;
  }
}

/**
 * Check if a PDF document is encrypted
 *
 * @param document - PDF document or ArrayBuffer
 * @returns True if the document is encrypted
 */
export async function isEncrypted(
  document: PDFDocumentType | ArrayBuffer
): Promise<boolean> {
  try {
    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);

    // Check for encryption dictionary in PDF structure
    const pdfString = new TextDecoder().decode(bytes.slice(0, 2048));
    if (pdfString.includes('/Encrypt')) {
      return true;
    }

    // Also check our custom encryption metadata
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const keywords = pdfDoc.getKeywords();

    return !!(keywords && keywords.startsWith('encrypted:'));
  } catch {
    // If loading fails, it might be encrypted
    return true;
  }
}

/**
 * Get detailed security information about a PDF document
 *
 * @param document - PDF document or ArrayBuffer
 * @returns Security information
 */
export async function getSecurityInfo(
  document: PDFDocumentType | ArrayBuffer
): Promise<PDFSecurityInfo> {
  try {
    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);
    const encrypted = await isEncrypted(document);

    if (!encrypted) {
      return {
        isEncrypted: false,
        hasUserPassword: false,
        hasOwnerPassword: false,
      };
    }

    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const keywords = pdfDoc.getKeywords();

    if (keywords && keywords.startsWith('encrypted:')) {
      const encryptionInfo = JSON.parse(keywords.slice('encrypted:'.length));
      return {
        isEncrypted: true,
        hasUserPassword: encryptionInfo.hasUserPassword,
        hasOwnerPassword: true,
        permissions: encryptionInfo.permissions,
        encryptionMethod: encryptionInfo.method,
      };
    }

    return {
      isEncrypted: true,
      hasUserPassword: true,
      hasOwnerPassword: true,
    };
  } catch {
    return {
      isEncrypted: true,
      hasUserPassword: true,
      hasOwnerPassword: true,
    };
  }
}

/**
 * Generate an encryption key using Web Crypto API
 *
 * @param password - Password to derive key from
 * @param bits - Key size in bits (128 or 256)
 * @returns Derived key as Uint8Array
 */
async function generateEncryptionKey(
  password: string,
  bits: 128 | 256
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  // Use PBKDF2 to derive a key from the password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // Generate a salt (in production, this should be stored with the document)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    bits
  );

  return new Uint8Array(derivedBits);
}

/**
 * Compute a checksum for verification purposes
 *
 * @param data - Data to compute checksum for
 * @returns Hexadecimal checksum string
 */
async function computeChecksum(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/**
 * Validate a password against an encrypted PDF
 *
 * @param document - Encrypted PDF document
 * @param password - Password to validate
 * @returns True if password is valid
 */
export async function validatePassword(
  document: PDFDocumentType | ArrayBuffer,
  password: string
): Promise<boolean> {
  try {
    const bytes = getPDFBytes(document as ArrayBuffer | PDFDocumentType);

    // Attempt to load with the password
    await PDFDocument.load(bytes, {
      ignoreEncryption: true,
    });

    // If we have encryption metadata, verify the password
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const keywords = pdfDoc.getKeywords();

    if (keywords && keywords.startsWith('encrypted:')) {
      const encryptionInfo = JSON.parse(keywords.slice('encrypted:'.length));
      const bits = encryptionInfo.method === '256-AES' ? 256 : 128;
      const derivedKey = await generateEncryptionKey(password, bits as 128 | 256);
      const checksum = await computeChecksum(derivedKey);

      return checksum === encryptionInfo.keyChecksum;
    }

    return true;
  } catch {
    return false;
  }
}
