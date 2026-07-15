import { readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import type { ServerOperationKind } from '@pdflover/shared';
import { ApiError } from '../errors.js';
import { runCommand } from './command.js';

interface EncryptOptions {
  userPassword?: unknown;
  ownerPassword?: unknown;
  permissions?: unknown;
  encryptionLevel?: unknown;
}

function password(value: unknown, name: string, required: boolean): string {
  if (value === undefined || value === null) {
    if (!required) return '';
    throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: `${name} is required` });
  }
  if (typeof value !== 'string' || value.length > 256 || (required && value.length === 0)) {
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: `${name} must be a non-empty string of at most 256 characters`,
    });
  }
  return value;
}

function permissions(value: unknown): {
  print: boolean;
  copy: boolean;
  modify: boolean;
  annotate: boolean;
  form: boolean;
  accessibility: boolean;
  assemble: boolean;
} {
  if (value === undefined) {
    return { print: true, copy: true, modify: true, annotate: true, form: true, accessibility: true, assemble: true };
  }
  if (!value || typeof value !== 'object') {
    throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'permissions must be an object' });
  }
  const input = value as Record<string, unknown>;
  for (const key of [
    'print', 'copy', 'modify', 'printing', 'copying', 'modifying',
    'annotating', 'fillingForms', 'contentAccessibility', 'documentAssembly',
  ]) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') {
      throw new ApiError({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: `permissions.${key} must be a boolean`,
      });
    }
  }
  return {
    print: input.print !== false && input.printing !== false,
    copy: input.copy !== false && input.copying !== false,
    modify: input.modify !== false && input.modifying !== false,
    annotate: input.annotating !== false,
    form: input.fillingForms !== false,
    // Conforming readers must preserve accessibility extraction; qpdf also
    // ignores this restriction for modern AES modes.
    accessibility: true,
    assemble: input.documentAssembly !== false,
  };
}

function outputName(inputFilename: string, suffix: string): string {
  const safe = basename(inputFilename);
  const extension = extname(safe);
  const stem = extension ? safe.slice(0, -extension.length) : safe;
  return `${stem || 'document'}_${suffix}.pdf`;
}

export async function executeQpdfOperation(input: {
  operation: ServerOperationKind;
  inputPath: string;
  inputFilename: string;
  options: unknown;
  timeoutMs: number;
  signal: AbortSignal;
}): Promise<{ data: Buffer; filename: string; mediaType: string }> {
  if (input.operation !== 'pdf.encrypt' && input.operation !== 'pdf.decrypt') {
    throw new ApiError({
      statusCode: 501,
      code: 'OPERATION_UNAVAILABLE',
      message: `No qpdf handler is registered for ${input.operation}`,
    });
  }
  const workDir = dirname(input.inputPath);
  const encrypted = input.operation === 'pdf.encrypt';
  const filename = outputName(input.inputFilename, encrypted ? 'encrypted' : 'decrypted');
  const outputPath = resolve(workDir, `engine-${filename}`);
  const jobPath = resolve(workDir, 'qpdf-job.json');
  const rawOptions = input.options && typeof input.options === 'object'
    ? input.options as EncryptOptions
    : {};

  let job: Record<string, unknown>;
  if (encrypted) {
    const ownerPassword = password(rawOptions.ownerPassword, 'ownerPassword', true);
    const userPassword = password(rawOptions.userPassword, 'userPassword', false);
    if (ownerPassword === userPassword) {
      throw new ApiError({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'ownerPassword must differ from userPassword',
      });
    }
    const allowed = permissions(rawOptions.permissions);
    const encryptionLevel = rawOptions.encryptionLevel ?? '256-AES';
    if (encryptionLevel !== '128-AES' && encryptionLevel !== '256-AES') {
      throw new ApiError({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'encryptionLevel must be 128-AES or 256-AES',
      });
    }
    const encryptionOptions = {
      print: allowed.print ? 'full' : 'none',
      extract: allowed.copy ? 'y' : 'n',
      modify: allowed.modify ? 'all' : 'none',
      annotate: allowed.annotate ? 'y' : 'n',
      form: allowed.form ? 'y' : 'n',
      accessibility: allowed.accessibility ? 'y' : 'n',
      assemble: allowed.assemble ? 'y' : 'n',
      ...(encryptionLevel === '128-AES' ? { useAes: 'y' } : {}),
    };
    job = {
      inputFile: input.inputPath,
      outputFile: outputPath,
      objectStreams: 'generate',
      encrypt: {
        userPassword,
        ownerPassword,
        [encryptionLevel === '128-AES' ? '128bit' : '256bit']: encryptionOptions,
      },
    };
  } else {
    job = {
      inputFile: input.inputPath,
      outputFile: outputPath,
      password: password(rawOptions.userPassword, 'userPassword', true),
      decrypt: '',
      objectStreams: 'generate',
    };
  }

  await writeFile(jobPath, JSON.stringify(job), { mode: 0o600, flag: 'wx' });
  try {
    const result = await runCommand({
      command: 'qpdf',
      args: [`--job-json-file=${jobPath}`],
      cwd: workDir,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
    });
    if (result.exitCode !== 0) {
      const invalidPassword = /invalid password/i.test(result.stderr);
      throw new ApiError({
        statusCode: invalidPassword ? 400 : 500,
        code: invalidPassword ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
        message: invalidPassword ? 'The PDF password was rejected' : 'qpdf could not process the document',
      });
    }
    return { data: await readFile(outputPath), filename, mediaType: 'application/pdf' };
  } finally {
    await Promise.all([
      rm(jobPath, { force: true }),
      rm(outputPath, { force: true }),
    ]);
  }
}
