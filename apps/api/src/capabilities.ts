import { execFile } from 'node:child_process';
import type {
  ApiCapabilities,
  EngineCapability,
  ServerOperationKind,
} from '@pdflover/shared';
import type { ApiConfig } from './config.js';

const SERVICE_VERSION = '0.1.0';

interface ProbeDefinition {
  id: EngineCapability['id'];
  command: string;
  args: string[];
  required: boolean;
}

const PROBES: ProbeDefinition[] = [
  { id: 'qpdf', command: 'qpdf', args: ['--version'], required: true },
  { id: 'python', command: 'python3', args: ['--version'], required: true },
  { id: 'pillow', command: 'python3', args: ['-c', 'import PIL; print(PIL.__version__)'], required: true },
  { id: 'python-docx', command: 'python3', args: ['-c', 'import docx; print(docx.__version__)'], required: true },
  { id: 'openpyxl', command: 'python3', args: ['-c', 'import openpyxl; print(openpyxl.__version__)'], required: true },
  { id: 'python-pptx', command: 'python3', args: ['-c', 'import pptx; print(pptx.__version__)'], required: true },
  { id: 'pyhanko', command: 'python3', args: ['-c', 'import importlib.metadata; print(importlib.metadata.version("pyHanko"))'], required: true },
  { id: 'tesseract', command: 'tesseract', args: ['--version'], required: true },
  { id: 'poppler', command: 'pdftocairo', args: ['-v'], required: true },
];

function firstLine(value: string): string | undefined {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function probe(definition: ProbeDefinition): Promise<EngineCapability> {
  return new Promise((resolve) => {
    execFile(
      definition.command,
      definition.args,
      { timeout: 5_000, maxBuffer: 64 * 1_024 },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            id: definition.id,
            available: false,
            required: definition.required,
            reason: error.code === 'ENOENT' ? 'executable not installed' : 'probe failed',
          });
          return;
        }
        resolve({
          id: definition.id,
          available: true,
          required: definition.required,
          version: firstLine(`${stdout}\n${stderr}`),
        });
      },
    );
  });
}

function operation(
  kind: ServerOperationKind,
  requiredEngines: EngineCapability['id'][],
  engines: EngineCapability[],
): ApiCapabilities['operations'][number] {
  const missing = requiredEngines.filter(
    (id) => !engines.find((engine) => engine.id === id)?.available,
  );
  return {
    kind,
    engine: 'server',
    available: missing.length === 0,
    unavailableReason:
      missing.length > 0 ? `Missing runtime engines: ${missing.join(', ')}` : undefined,
  };
}

export async function readCapabilities(config: ApiConfig): Promise<ApiCapabilities> {
  const engines = await Promise.all(PROBES.map(probe));
  return {
    serviceVersion: SERVICE_VERSION,
    maxUploadBytes: config.maxUploadBytes,
    artifactTtlSeconds: Math.floor(config.artifactTtlMs / 1_000),
    engines,
    operations: [
      operation('pdf.encrypt', ['qpdf'], engines),
      operation('pdf.decrypt', ['qpdf'], engines),
      operation('pdf.secure-redact', ['qpdf', 'python', 'pillow', 'poppler'], engines),
      operation('pdf.digital-sign', ['python', 'pyhanko', 'qpdf'], engines),
      operation('pdf.ocr', ['python', 'pillow', 'poppler', 'tesseract', 'qpdf'], engines),
      operation('pdf.convert.docx', ['python', 'python-docx', 'poppler'], engines),
      operation('pdf.convert.xlsx', ['python', 'openpyxl', 'poppler'], engines),
      operation('pdf.convert.pptx', ['python', 'pillow', 'python-pptx', 'poppler'], engines),
      operation('pdf.compress.lossy', ['python', 'pillow', 'qpdf', 'poppler'], engines),
    ],
    ai: {
      openRouterConfigured: config.openRouterApiKey !== undefined,
    },
  };
}

export function requiredEnginesReady(capabilities: ApiCapabilities): boolean {
  return capabilities.engines
    .filter((engine) => engine.required)
    .every((engine) => engine.available);
}
