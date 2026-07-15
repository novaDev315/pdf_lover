import type { ServerOperationKind } from '@pdflover/shared';
import { executeQpdfOperation } from './qpdf.js';
import { executeSecureRedaction } from './secure-redact.js';
import { executeDocumentOperation } from './document-ops.js';
import { executeDigitalSign } from './digital-sign.js';

export interface ServerOperationInput {
  operation: ServerOperationKind;
  inputPath: string;
  inputFilename: string;
  certificatePath?: string;
  options: unknown;
  timeoutMs: number;
  signal: AbortSignal;
}

export async function executeServerOperation(input: ServerOperationInput) {
  if (input.operation === 'pdf.secure-redact') return executeSecureRedaction(input);
  if (input.operation === 'pdf.digital-sign') return executeDigitalSign(input);
  if (
    input.operation === 'pdf.ocr' ||
    input.operation === 'pdf.convert.docx' ||
    input.operation === 'pdf.convert.xlsx' ||
    input.operation === 'pdf.convert.pptx' ||
    input.operation === 'pdf.compress.lossy'
  ) {
    return executeDocumentOperation(input);
  }
  return executeQpdfOperation(input);
}
