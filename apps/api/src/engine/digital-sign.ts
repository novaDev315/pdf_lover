import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../errors.js';
import { runCommand } from './command.js';

interface DigitalSignOptions {
  certificatePassword: string;
  fieldName: string;
  signerName?: string;
  reason?: string;
  location?: string;
}

function optionalText(input: Record<string, unknown>, key: string, maximum: number): string | undefined {
  const value = input[key];
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || value.length > maximum) {
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: `${key} must be a string of at most ${maximum} characters`,
    });
  }
  return value;
}

export function parseDigitalSignOptions(value: unknown): DigitalSignOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'Digital signing options must be an object' });
  }
  const input = value as Record<string, unknown>;
  const certificatePassword = input.certificatePassword;
  if (typeof certificatePassword !== 'string' || certificatePassword.length > 256) {
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'certificatePassword must be a string of at most 256 characters',
    });
  }
  const fieldName = input.fieldName ?? 'PDFLoverSignature';
  if (typeof fieldName !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(fieldName)) {
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'fieldName must start with a letter and contain at most 64 safe characters',
    });
  }
  return {
    certificatePassword,
    fieldName,
    signerName: optionalText(input, 'signerName', 200),
    reason: optionalText(input, 'reason', 500),
    location: optionalText(input, 'location', 200),
  };
}

function outputName(inputFilename: string): string {
  const safe = basename(inputFilename);
  const extension = extname(safe);
  const stem = extension ? safe.slice(0, -extension.length) : safe;
  return `${stem || 'document'}_digitally_signed.pdf`;
}

export async function executeDigitalSign(input: {
  inputPath: string;
  inputFilename: string;
  certificatePath?: string;
  options: unknown;
  timeoutMs: number;
  signal: AbortSignal;
}): Promise<{ data: Buffer; filename: string; mediaType: string }> {
  if (!input.certificatePath) {
    throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'A PKCS#12 certificate is required' });
  }
  const options = parseDigitalSignOptions(input.options);
  const directory = dirname(input.inputPath);
  const filename = outputName(input.inputFilename);
  const outputPath = resolve(directory, `engine-${filename}`);
  const optionsPath = resolve(directory, 'digital-sign-options.json');
  const scriptPath = fileURLToPath(new URL('../../scripts/digital_sign.py', import.meta.url));
  await writeFile(optionsPath, JSON.stringify(options), { mode: 0o600, flag: 'wx' });
  try {
    const result = await runCommand({
      command: 'python3',
      args: [
        scriptPath,
        '--input', input.inputPath,
        '--certificate', input.certificatePath,
        '--output', outputPath,
        '--options', optionsPath,
      ],
      cwd: directory,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
    });
    if (result.exitCode !== 0) {
      throw new ApiError({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: result.stderr.trim() || 'The certificate could not sign this PDF',
      });
    }
    const output = await stat(outputPath);
    if (output.size < 5 || output.size > 300 * 1024 * 1024) {
      throw new ApiError({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Signing engine produced an invalid artifact size' });
    }
    const data = await readFile(outputPath);
    if (data.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new ApiError({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Signing engine produced an invalid PDF' });
    }
    const check = await runCommand({
      command: 'qpdf',
      args: ['--check', outputPath],
      cwd: directory,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
    });
    if (check.exitCode !== 0 && check.exitCode !== 3) {
      throw new ApiError({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Signed PDF failed structural validation' });
    }
    return { data, filename, mediaType: 'application/pdf' };
  } finally {
    await Promise.all([rm(optionsPath, { force: true }), rm(outputPath, { force: true })]);
  }
}
