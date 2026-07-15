import { readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../errors.js';
import { runCommand } from './command.js';

interface RedactionRectangle {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function parseOptions(value: unknown): { redactions: RedactionRectangle[]; dpi: number } {
  if (!value || typeof value !== 'object') {
    throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'Redaction options must be an object' });
  }
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.redactions) || input.redactions.length < 1 || input.redactions.length > 500) {
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'redactions must contain between 1 and 500 rectangles',
    });
  }
  const redactions = input.redactions.map((candidate, index): RedactionRectangle => {
    if (!candidate || typeof candidate !== 'object') {
      throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: `redactions[${index}] must be an object` });
    }
    const rectangle = candidate as Record<string, unknown>;
    if (!Number.isSafeInteger(rectangle.page) || Number(rectangle.page) < 1) {
      throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: `redactions[${index}].page is invalid` });
    }
    for (const field of ['x', 'y', 'width', 'height'] as const) {
      const number = rectangle[field];
      if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || ((field === 'width' || field === 'height') && number === 0)) {
        throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: `redactions[${index}].${field} is invalid` });
      }
    }
    return rectangle as unknown as RedactionRectangle;
  });
  const dpi = input.dpi ?? 150;
  if (!Number.isSafeInteger(dpi) || Number(dpi) < 72 || Number(dpi) > 300) {
    throw new ApiError({ statusCode: 400, code: 'BAD_REQUEST', message: 'dpi must be an integer between 72 and 300' });
  }
  return { redactions, dpi: Number(dpi) };
}

function outputName(inputFilename: string): string {
  const safe = basename(inputFilename);
  const extension = extname(safe);
  const stem = extension ? safe.slice(0, -extension.length) : safe;
  return `${stem || 'document'}_redacted.pdf`;
}

export async function executeSecureRedaction(input: {
  inputPath: string;
  inputFilename: string;
  options: unknown;
  timeoutMs: number;
  signal: AbortSignal;
}): Promise<{ data: Buffer; filename: string; mediaType: string }> {
  const options = parseOptions(input.options);
  const workDir = dirname(input.inputPath);
  const filename = outputName(input.inputFilename);
  const outputPath = resolve(workDir, `engine-${filename}`);
  const optionsPath = resolve(workDir, 'redaction-options.json');
  const scriptPath = fileURLToPath(new URL('../../scripts/secure_redact.py', import.meta.url));
  await writeFile(optionsPath, JSON.stringify(options), { mode: 0o600, flag: 'wx' });
  try {
    const result = await runCommand({
      command: 'python3',
      args: [
        scriptPath,
        '--input', input.inputPath,
        '--output', outputPath,
        '--options', optionsPath,
        '--dpi', String(options.dpi),
      ],
      cwd: workDir,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
    });
    if (result.exitCode !== 0) {
      throw new ApiError({
        statusCode: 400,
        code: 'INVALID_PDF',
        message: result.stderr.trim() || 'The PDF could not be securely redacted',
      });
    }
    const check = await runCommand({
      command: 'qpdf',
      args: ['--check', outputPath],
      cwd: workDir,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
    });
    if (check.exitCode !== 0 && check.exitCode !== 3) {
      throw new ApiError({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Redacted PDF failed structural validation' });
    }
    const data = await readFile(outputPath);
    if (data.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new ApiError({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Redaction engine produced an invalid artifact' });
    }
    return { data, filename, mediaType: 'application/pdf' };
  } finally {
    await Promise.all([
      rm(optionsPath, { force: true }),
      rm(outputPath, { force: true }),
      rm(resolve(workDir, 'redaction-pages'), { recursive: true, force: true }),
    ]);
  }
}
