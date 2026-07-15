/**
 * Browser-safe PDF security inspection.
 *
 * Encryption and decryption are intentionally owned by the backend qpdf
 * handler. pdf-lib cannot perform these operations and must never report a
 * metadata-only rewrite as encrypted or decrypted output.
 */

import type { PDFDocument as PDFDocumentType } from '@pdflover/shared';
import { getPDFBytes } from './utils.js';

export type EncryptionLevel = '128-AES' | '256-AES';

export interface PDFPermissions {
  printing: boolean;
  copying: boolean;
  modifying: boolean;
  annotating: boolean;
  fillingForms: boolean;
  contentAccessibility: boolean;
  documentAssembly: boolean;
  highQualityPrint: boolean;
}

export interface EncryptOptions {
  document: PDFDocumentType | ArrayBuffer;
  userPassword?: string;
  ownerPassword: string;
  encryptionLevel?: EncryptionLevel;
  permissions?: Partial<PDFPermissions>;
}

export interface DecryptOptions {
  document: PDFDocumentType | ArrayBuffer;
  password: string;
}

export interface PDFSecurityInfo {
  isEncrypted: boolean;
  /** Cannot be determined safely in the browser without opening the file. */
  hasUserPassword?: boolean;
  /** Cannot be determined safely in the browser without opening the file. */
  hasOwnerPassword?: boolean;
  permissions?: PDFPermissions;
  encryptionMethod?: string;
}

const ENCRYPT_MARKER = new TextEncoder().encode('/Encrypt');

function containsBytes(source: Uint8Array, target: Uint8Array): boolean {
  if (target.length === 0 || target.length > source.length) return false;
  outer: for (let index = 0; index <= source.length - target.length; index++) {
    for (let offset = 0; offset < target.length; offset++) {
      if (source[index + offset] !== target[offset]) continue outer;
    }
    return true;
  }
  return false;
}

/** Detect the standard PDF encryption dictionary marker without passwords. */
export async function isEncrypted(
  document: PDFDocumentType | ArrayBuffer,
): Promise<boolean> {
  return containsBytes(getPDFBytes(document), ENCRYPT_MARKER);
}

/**
 * Return only information that can be established without guessing or
 * requesting a password. Detailed permissions come from the server engine.
 */
export async function getSecurityInfo(
  document: PDFDocumentType | ArrayBuffer,
): Promise<PDFSecurityInfo> {
  return { isEncrypted: await isEncrypted(document) };
}

export async function getPermissions(
  document: PDFDocumentType | ArrayBuffer,
): Promise<PDFPermissions | null> {
  if (await isEncrypted(document)) return null;
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
}
