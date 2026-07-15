import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServerOperationKind } from '@pdflover/shared';
import { ApiError } from '../errors.js';
import { runCommand } from './command.js';

const DOCUMENT_OPERATIONS = new Set<ServerOperationKind>([
  'pdf.ocr',
  'pdf.convert.docx',
  'pdf.convert.xlsx',
  'pdf.convert.pptx',
  'pdf.compress.lossy',
]);
const OCR_LANGUAGES = new Set([
  'eng', 'spa', 'fra', 'deu', 'ita', 'por', 'nld', 'pol', 'rus',
  'jpn', 'chi_sim', 'chi_tra', 'kor', 'ara', 'hin',
]);
const MAX_ARTIFACT_BYTES = 300 * 1024 * 1024;

interface DocumentOperationOptions {
  dpi: number;
  quality: number;
  language: string;
  enhanceScans: boolean;
}

function integer(
  input: Record<string, unknown>,
  key: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const value = input[key] ?? defaultValue;
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: `${key} must be an integer between ${minimum} and ${maximum}`,
    });
  }
  return Number(value);
}

export function parseDocumentOperationOptions(
  operation: ServerOperationKind,
  value: unknown,
): DocumentOperationOptions {
  if (!DOCUMENT_OPERATIONS.has(operation)) {
    throw new ApiError({ statusCode: 501, code: 'OPERATION_UNAVAILABLE', message: `No document handler is registered for ${operation}` });
  }
  if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) {
    throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'Operation options must be an object' });
  }
  const input = (value ?? {}) as Record<string, unknown>;
  const language = input.language ?? 'eng';
  if (typeof language !== 'string' || !OCR_LANGUAGES.has(language)) {
    throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'language is not a supported OCR language' });
  }
  const enhanceScans = input.enhanceScans ?? false;
  if (typeof enhanceScans !== 'boolean') {
    throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'enhanceScans must be a boolean' });
  }
  return {
    dpi: integer(input, 'dpi', operation === 'pdf.compress.lossy' ? 120 : 150, 72, 300),
    quality: integer(input, 'quality', 70, 30, 95),
    language,
    enhanceScans,
  };
}

function artifact(operation: ServerOperationKind, inputFilename: string) {
  const safe = basename(inputFilename);
  const extension = extname(safe);
  const stem = extension ? safe.slice(0, -extension.length) : safe;
  const base = stem || 'document';
  switch (operation) {
    case 'pdf.ocr':
      return { filename: `${base}_searchable.pdf`, mediaType: 'application/pdf', extension: 'pdf' };
    case 'pdf.compress.lossy':
      return { filename: `${base}_compressed.pdf`, mediaType: 'application/pdf', extension: 'pdf' };
    case 'pdf.convert.docx':
      return { filename: `${base}.docx`, mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' };
    case 'pdf.convert.xlsx':
      return { filename: `${base}.xlsx`, mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' };
    case 'pdf.convert.pptx':
      return { filename: `${base}.pptx`, mediaType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: 'pptx' };
    default:
      throw new ApiError({ statusCode: 501, code: 'OPERATION_UNAVAILABLE', message: `No artifact contract exists for ${operation}` });
  }
}

export async function executeDocumentOperation(input: {
  operation: ServerOperationKind;
  inputPath: string;
  inputFilename: string;
  options: unknown;
  timeoutMs: number;
  signal: AbortSignal;
}): Promise<{ data: Buffer; filename: string; mediaType: string }> {
  const options = parseDocumentOperationOptions(input.operation, input.options);
  const contract = artifact(input.operation, input.inputFilename);
  const directory = dirname(input.inputPath);
  const outputPath = resolve(directory, `engine-output.${contract.extension}`);
  const optionsPath = resolve(directory, 'document-options.json');
  const engineWorkdir = resolve(directory, 'document-engine');
  const scriptPath = fileURLToPath(new URL('../../scripts/document_ops.py', import.meta.url));
  await writeFile(optionsPath, JSON.stringify(options), { mode: 0o600, flag: 'wx' });
  try {
    const result = await runCommand({
      command: 'python3',
      args: [
        scriptPath,
        '--operation', input.operation,
        '--input', input.inputPath,
        '--output', outputPath,
        '--options', optionsPath,
        '--workdir', engineWorkdir,
      ],
      cwd: directory,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
    });
    if (result.exitCode !== 0) {
      throw new ApiError({
        statusCode: 400,
        code: 'INVALID_PDF',
        message: result.stderr.trim() || 'The document operation could not process this PDF',
      });
    }
    const output = await stat(outputPath);
    if (output.size < 5 || output.size > MAX_ARTIFACT_BYTES) {
      throw new ApiError({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Document engine produced an invalid artifact size' });
    }
    const data = await readFile(outputPath);
    const expectedHeader = contract.extension === 'pdf' ? '%PDF-' : 'PK';
    if (!data.subarray(0, expectedHeader.length).toString('ascii').startsWith(expectedHeader)) {
      throw new ApiError({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Document engine produced an invalid artifact' });
    }
    if (contract.extension === 'pdf') {
      const check = await runCommand({
        command: 'qpdf',
        args: ['--check', outputPath],
        cwd: directory,
        timeoutMs: input.timeoutMs,
        signal: input.signal,
      });
      if (check.exitCode !== 0 && check.exitCode !== 3) {
        throw new ApiError({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Generated PDF failed structural validation' });
      }
    }
    return { data, filename: contract.filename, mediaType: contract.mediaType };
  } finally {
    await Promise.all([
      rm(optionsPath, { force: true }),
      rm(outputPath, { force: true }),
      rm(engineWorkdir, { recursive: true, force: true }),
    ]);
  }
}
