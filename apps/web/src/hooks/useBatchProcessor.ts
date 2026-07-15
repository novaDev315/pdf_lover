/**
 * useBatchProcessor - Hook for processing batch operations queue
 * Processes operations sequentially with progress reporting and error handling
 */

import * as React from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  useBatchStore,
  selectIsQueueProcessing,
  type BatchOperation,
  type BatchOperationResult,
  type BatchOperationArtifact,
  type CompressOptions,
  type WatermarkOptions,
  type SplitOptions,
  type ConvertOptions,
  type CropOptions,
  type TrimOptions,
  type ResizeOptions,
  type OCROptions,
} from '@/store/batch-store';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/storage/indexeddb';
import { runServerPdfOperation } from '@/lib/api';
import type { ProgressInfo } from '@pdflover/shared';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Dynamic imports for pdf-core to avoid module resolution issues at build time
const getPdfCore = async () => {
  const pdfCore = await import('@pdflover/pdf-core');
  return pdfCore;
};

function withoutExtension(filename: string): string {
  return filename.replace(/\.pdf$/i, '');
}

function pdfArtifact(data: ArrayBuffer, filename: string): BatchOperationArtifact {
  return { data, filename, mediaType: 'application/pdf' };
}

function mediaTypeForFormat(format: ConvertOptions['format']): string {
  const types: Record<ConvertOptions['format'], string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    txt: 'text/plain;charset=utf-8',
    html: 'text/html;charset=utf-8',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return types[format];
}

function parseRanges(input: string): Array<{ start: number; end: number }> {
  const ranges = input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
      if (!match) throw new Error(`Invalid page range: ${part}`);
      const start = Number(match[1]);
      const end = Number(match[2] ?? match[1]);
      if (start < 1 || end < start) throw new Error(`Invalid page range: ${part}`);
      return { start, end };
    });
  if (ranges.length === 0) throw new Error('At least one page range is required');
  return ranges;
}

async function pageCount(buffer: ArrayBuffer): Promise<number> {
  const document = await pdfjsLib.getDocument({ data: new Uint8Array(buffer).slice() }).promise;
  try {
    return document.numPages;
  } finally {
    await document.destroy();
  }
}

/**
 * State for the batch processor
 */
export interface BatchProcessorState {
  /** Whether the processor is currently running */
  isRunning: boolean;
  /** Current operation being processed */
  currentOperation: BatchOperation | null;
  /** Abort controller for cancellation */
  abortController: AbortController | null;
}

/**
 * Options for useBatchProcessor hook
 */
export interface UseBatchProcessorOptions {
  /** Automatically start processing when queue starts */
  autoProcess?: boolean;
  /** Store results in IndexedDB */
  storeResults?: boolean;
  /** Show toast notifications */
  showToasts?: boolean;
  /** Callback when operation completes */
  onOperationComplete?: (operation: BatchOperation, result: BatchOperationResult) => void;
  /** Callback when all operations complete */
  onQueueComplete?: () => void;
  /** Callback when an operation fails */
  onOperationFailed?: (operation: BatchOperation, error: Error) => void;
}

/**
 * Return type for useBatchProcessor hook
 */
export interface UseBatchProcessorReturn {
  /** Current processor state */
  state: BatchProcessorState;
  /** Start processing the queue */
  startProcessing: () => void;
  /** Stop processing (current operation completes) */
  stopProcessing: () => void;
  /** Cancel current operation */
  cancelCurrent: () => void;
  /** Process a single operation */
  processOperation: (operation: BatchOperation) => Promise<BatchOperationResult>;
}

/**
 * Process a merge operation
 */
async function processMerge(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void
): Promise<BatchOperationArtifact[]> {
  const pdfCore = await getPdfCore();
  const files = operation.files.map((f) => f.file);
  const result = await pdfCore.mergePDFFiles(files, {
    outputFilename: 'merged.pdf',
    onProgress,
  });

  if (!result.success || !result.data) {
    throw new Error(result.error ?? 'Merge operation failed');
  }

  const options = operation.options as { outputFilename?: string };
  return [pdfArtifact(result.data, options.outputFilename || 'merged.pdf')];
}

/**
 * Process a compress operation
 */
async function processCompress(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void,
  signal?: AbortSignal,
): Promise<BatchOperationArtifact[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as CompressOptions;
  const results: BatchOperationArtifact[] = [];

  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i];
    if (!fileInfo) continue;
    if (options.level === 'maximum') {
      if (!options.serverConsent) throw new Error('Temporary server processing consent is required');
      const artifacts = await runServerPdfOperation({
        operation: 'pdf.compress.lossy',
        file: fileInfo.file,
        options: { quality: 60, dpi: 120 },
        signal,
        onProgress: (info) => onProgress({
          ...info,
          percentage: ((i + info.percentage / 100) / operation.files.length) * 100,
          stage: `Compressing ${fileInfo.name}: ${info.stage}`,
        }),
      });
      results.push(...artifacts);
      continue;
    }
    const buffer = await fileInfo.file.arrayBuffer();

    const result = await pdfCore.compressPDF({
      document: buffer,
      level: options.level,
      onProgress: (info: ProgressInfo) => {
        // Adjust progress for multiple files
        const fileProgress = (i / operation.files.length) * 100;
        const currentProgress = info.percentage / operation.files.length;
        onProgress({
          ...info,
          percentage: fileProgress + currentProgress,
          stage: `Compressing ${fileInfo.name}...`,
        });
      },
    });

    if (!result.success || !result.data) {
      throw new Error(result.error ?? `Failed to compress ${fileInfo.name}`);
    }

    results.push(pdfArtifact(result.data, `${withoutExtension(fileInfo.name)}_compressed.pdf`));
  }

  return results;
}

/**
 * Process a split operation
 */
async function processSplit(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void
): Promise<BatchOperationArtifact[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as SplitOptions;
  const results: BatchOperationArtifact[] = [];

  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i];
    if (!fileInfo) continue;
    const buffer = await fileInfo.file.arrayBuffer();

    let splitMode: 'single' | 'range' = 'single';
    let ranges: Array<{ start: number; end: number }> | undefined;
    if (options.mode === 'range') {
      if (!options.ranges) throw new Error('Page ranges are required');
      splitMode = 'range';
      ranges = parseRanges(options.ranges);
    } else if (options.mode === 'even' || options.mode === 'odd') {
      const count = await pageCount(buffer);
      const parity = options.mode === 'even' ? 0 : 1;
      ranges = Array.from({ length: count }, (_, index) => index + 1)
        .filter((page) => page % 2 === parity)
        .map((page) => ({ start: page, end: page }));
      if (ranges.length === 0) throw new Error(`Document has no ${options.mode} pages`);
      splitMode = 'range';
    }

    const result = await pdfCore.splitPDF({
      document: buffer,
      mode: splitMode,
      ranges,
      outputPrefix: `${withoutExtension(fileInfo.name)}_split`,
      onProgress: (info: ProgressInfo) => {
        const fileProgress = (i / operation.files.length) * 100;
        const currentProgress = info.percentage / operation.files.length;
        onProgress({
          ...info,
          percentage: fileProgress + currentProgress,
          stage: `Splitting ${fileInfo.name}...`,
        });
      },
    } as Parameters<typeof pdfCore.splitPDF>[0]);

    if (!result.success || !result.files?.length) {
      throw new Error(result.error ?? `Failed to split ${fileInfo.name}`);
    }
    results.push(...result.files.map((file) => pdfArtifact(file.data, file.filename)));
  }

  return results;
}

/**
 * Process a watermark operation
 */
async function processWatermark(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void
): Promise<BatchOperationArtifact[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as WatermarkOptions;
  const results: BatchOperationArtifact[] = [];

  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i];
    if (!fileInfo) continue;
    const buffer = await fileInfo.file.arrayBuffer();

    const result = await pdfCore.addTextWatermark({
      document: buffer,
      text: options.text,
      position: options.position,
      opacity: options.opacity,
      fontSize: options.fontSize,
      color: options.color,
      rotation: options.rotation,
      onProgress: (info: ProgressInfo) => {
        const fileProgress = (i / operation.files.length) * 100;
        const currentProgress = info.percentage / operation.files.length;
        onProgress({
          ...info,
          percentage: fileProgress + currentProgress,
          stage: `Adding watermark to ${fileInfo.name}...`,
        });
      },
    });

    if (!result.success || !result.data) {
      throw new Error(result.error ?? `Failed to add watermark to ${fileInfo.name}`);
    }

    results.push(pdfArtifact(result.data, `${withoutExtension(fileInfo.name)}_watermarked.pdf`));
  }

  return results;
}

/**
 * Process a security operation
 */
async function processSecurity(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void,
  signal?: AbortSignal,
): Promise<BatchOperationArtifact[]> {
  const options = operation.options as import('@/store/batch-store').SecurityOptions;
  if (!options.ownerPassword) throw new Error('Owner password is required for PDF encryption');
  const results: BatchOperationArtifact[] = [];
  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i]!;
    const artifacts = await runServerPdfOperation({
      operation: 'pdf.encrypt',
      file: fileInfo.file,
      options,
      signal,
      onProgress: (info) => onProgress({
        ...info,
        percentage: ((i + info.percentage / 100) / operation.files.length) * 100,
        stage: `Securing ${fileInfo.name}: ${info.stage}`,
      }),
    });
    results.push(...artifacts);
  }
  return results;
}

/**
 * Process an OCR operation
 */
async function processOCR(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void,
  signal?: AbortSignal,
): Promise<BatchOperationArtifact[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as OCROptions;
  const results: BatchOperationArtifact[] = [];

  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i];
    if (!fileInfo) continue;
    if (options.engine === 'server') {
      if (!options.serverConsent) throw new Error('Temporary server processing consent is required');
      const artifacts = await runServerPdfOperation({
        operation: 'pdf.ocr',
        file: fileInfo.file,
        options: { language: options.language, enhanceScans: options.enhanceScans, dpi: 200 },
        signal,
        onProgress: (info) => onProgress({
          ...info,
          percentage: ((i + info.percentage / 100) / operation.files.length) * 100,
          stage: `OCR ${fileInfo.name}: ${info.stage}`,
        }),
      });
      results.push(...artifacts);
      continue;
    }
    const buffer = await fileInfo.file.arrayBuffer();
    const pdfDocument = await pdfjsLib.getDocument({ data: new Uint8Array(buffer).slice() }).promise;
    const canvases: HTMLCanvasElement[] = [];

    try {
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = globalThis.document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas rendering is unavailable');
        await page.render({ canvasContext: context, viewport }).promise;

        if (options.enhanceScans) {
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          for (let offset = 0; offset < pixels.data.length; offset += 4) {
            const luminance =
              pixels.data[offset]! * 0.299 +
              pixels.data[offset + 1]! * 0.587 +
              pixels.data[offset + 2]! * 0.114;
            const enhanced = luminance < 170 ? Math.max(0, luminance * 0.75) : Math.min(255, luminance * 1.08);
            pixels.data[offset] = enhanced;
            pixels.data[offset + 1] = enhanced;
            pixels.data[offset + 2] = enhanced;
          }
          context.putImageData(pixels, 0, 0);
        }

        canvases.push(canvas);
        onProgress({
          percentage: ((i + pageNumber / pdfDocument.numPages * 0.2) / operation.files.length) * 100,
          stage: `Rendering ${fileInfo.name}, page ${pageNumber}...`,
          currentItem: pageNumber,
          totalItems: pdfDocument.numPages,
        });
      }

      const language = pdfCore.isValidLanguageCode(options.language) ? options.language : 'eng';
      const ocr = await pdfCore.ocrPDF(canvases, {
        languages: [language],
        onProgress: (info: ProgressInfo) => onProgress({
          ...info,
          percentage: ((i + 0.2 + info.percentage / 100 * 0.7) / operation.files.length) * 100,
          stage: `OCR ${fileInfo.name}: ${info.stage}`,
        }),
      });
      if (!ocr.success || !ocr.data) {
        throw new Error(ocr.error ?? `OCR failed for ${fileInfo.name}`);
      }

      const searchable = await pdfCore.addTextLayerToPDF(new Uint8Array(buffer), ocr.data, 2);
      if (!searchable.success || !searchable.data) {
        throw new Error(searchable.error ?? `Could not create searchable PDF for ${fileInfo.name}`);
      }
      results.push(pdfArtifact(searchable.data, `${withoutExtension(fileInfo.name)}_searchable.pdf`));
      onProgress({
        percentage: ((i + 1) / operation.files.length) * 100,
        stage: `Created searchable PDF for ${fileInfo.name}`,
      });
    } finally {
      await pdfDocument.destroy();
    }
  }

  return results;
}

/**
 * Process a convert operation
 */
async function processConvert(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void,
  signal?: AbortSignal,
): Promise<BatchOperationArtifact[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as ConvertOptions;
  const results: BatchOperationArtifact[] = [];

  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i];
    if (!fileInfo) continue;
    if (options.format === 'docx' || options.format === 'xlsx' || options.format === 'pptx') {
      if (!options.serverConsent) throw new Error('Temporary server processing consent is required');
      const artifacts = await runServerPdfOperation({
        operation: `pdf.convert.${options.format}`,
        file: fileInfo.file,
        options: { dpi: 150 },
        signal,
        onProgress: (info) => onProgress({
          ...info,
          percentage: ((i + info.percentage / 100) / operation.files.length) * 100,
          stage: `Converting ${fileInfo.name}: ${info.stage}`,
        }),
      });
      results.push(...artifacts);
      continue;
    }
    const buffer = await fileInfo.file.arrayBuffer();

    const result = await pdfCore.convertPDF({
      document: buffer,
      outputFormat: options.format,
      imageQuality:
        options.quality !== undefined && options.quality >= 90
          ? 'maximum'
          : options.quality !== undefined && options.quality >= 75
            ? 'high'
            : options.quality !== undefined && options.quality < 50
              ? 'low'
              : 'medium',
      onProgress: (info: ProgressInfo) => {
        const fileProgress = (i / operation.files.length) * 100;
        const currentProgress = info.percentage / operation.files.length;
        onProgress({
          ...info,
          percentage: fileProgress + currentProgress,
          stage: `Converting ${fileInfo.name}...`,
        });
      },
    });

    if (!result.success || (!result.data && !result.files?.length)) {
      throw new Error(result.error ?? `Failed to convert ${fileInfo.name}`);
    }
    if (result.files?.length) {
      results.push(...result.files.map((artifact) => ({
        data: artifact.data,
        filename:
          operation.files.length > 1
            ? `${withoutExtension(fileInfo.name)}_${artifact.filename}`
            : artifact.filename,
        mediaType: mediaTypeForFormat(options.format),
      })));
    } else if (result.data) {
      results.push({
        data: result.data,
        filename: `${withoutExtension(fileInfo.name)}.${options.format}`,
        mediaType: mediaTypeForFormat(options.format),
      });
    }
  }

  return results;
}

async function processCrop(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void
): Promise<BatchOperationArtifact[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as CropOptions;
  const results: BatchOperationArtifact[] = [];
  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i]!;
    const result = await pdfCore.cropPages({
      document: await fileInfo.file.arrayBuffer(),
      cropPercent: options.cropMode === 'percentage' ? options.cropPercent : undefined,
      cropBox: options.cropMode === 'absolute' ? options.cropBox : undefined,
      boxType: options.boxType,
      onProgress: (info: ProgressInfo) => onProgress({
        ...info,
        percentage: ((i + info.percentage / 100) / operation.files.length) * 100,
        stage: `Cropping ${fileInfo.name}: ${info.stage}`,
      }),
    });
    if (!result.success || !result.data) throw new Error(result.error ?? `Failed to crop ${fileInfo.name}`);
    results.push(pdfArtifact(result.data, `${withoutExtension(fileInfo.name)}_cropped.pdf`));
  }
  return results;
}

async function processTrim(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void
): Promise<BatchOperationArtifact[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as TrimOptions;
  const results: BatchOperationArtifact[] = [];
  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i]!;
    const result = await pdfCore.trimMargins({
      document: await fileInfo.file.arrayBuffer(),
      threshold: options.threshold,
      padding: options.padding,
      uniformPadding: options.uniformPadding,
      onProgress: (info: ProgressInfo) => onProgress({
        ...info,
        percentage: ((i + info.percentage / 100) / operation.files.length) * 100,
        stage: `Trimming ${fileInfo.name}: ${info.stage}`,
      }),
    });
    if (!result.success || !result.data) throw new Error(result.error ?? `Failed to trim ${fileInfo.name}`);
    results.push(pdfArtifact(result.data, `${withoutExtension(fileInfo.name)}_trimmed.pdf`));
  }
  return results;
}

async function processResize(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void
): Promise<BatchOperationArtifact[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as ResizeOptions;
  const results: BatchOperationArtifact[] = [];
  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i]!;
    let width = options.resizeMode === 'custom' ? options.width : undefined;
    let height = options.resizeMode === 'custom' ? options.height : undefined;
    const preset = options.resizeMode !== 'custom' && typeof options.preset === 'string' && options.preset in pdfCore.PAGE_SIZES
      ? options.preset as keyof typeof pdfCore.PAGE_SIZES
      : undefined;
    if (options.orientation === 'landscape') {
      if (preset) {
        const dimensions = pdfCore.PAGE_SIZES[preset];
        width = Math.max(dimensions.width, dimensions.height);
        height = Math.min(dimensions.width, dimensions.height);
      } else if (width && height && height > width) {
        [width, height] = [height, width];
      }
    }
    const result = await pdfCore.resizePages({
      document: await fileInfo.file.arrayBuffer(),
      preset: width && height ? undefined : preset,
      width,
      height,
      preserveAspectRatio: options.maintainAspectRatio,
      scaleContent: options.scaleContent,
      centerContent: options.centerContent,
      onProgress: (info: ProgressInfo) => onProgress({
        ...info,
        percentage: ((i + info.percentage / 100) / operation.files.length) * 100,
        stage: `Resizing ${fileInfo.name}: ${info.stage}`,
      }),
    });
    if (!result.success || !result.data) throw new Error(result.error ?? `Failed to resize ${fileInfo.name}`);
    results.push(pdfArtifact(result.data, `${withoutExtension(fileInfo.name)}_resized.pdf`));
  }
  return results;
}

/**
 * Hook for processing batch operations
 */
export function useBatchProcessor(
  options: UseBatchProcessorOptions = {}
): UseBatchProcessorReturn {
  const {
    autoProcess = true,
    storeResults = true,
    showToasts = true,
    onOperationComplete,
    onQueueComplete,
    onOperationFailed,
  } = options;

  const { toast } = useToast();

  const isQueueProcessing = useBatchStore(selectIsQueueProcessing);

  const {
    updateOperationProgress,
    updateOperationStatus,
    setCurrentOperation,
  } = useBatchStore();

  const [state, setState] = React.useState<BatchProcessorState>({
    isRunning: false,
    currentOperation: null,
    abortController: null,
  });

  const isRunningRef = React.useRef(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  /**
   * Process a single operation
   */
  const processOperation = React.useCallback(
    async (operation: BatchOperation): Promise<BatchOperationResult> => {
      const startTime = Date.now();

      // Progress handler
      const handleProgress = (info: ProgressInfo) => {
        updateOperationProgress(operation.id, info.percentage, info.stage);
      };

      try {
        let artifacts: BatchOperationArtifact[];

        switch (operation.type) {
          case 'merge':
            artifacts = await processMerge(operation, handleProgress);
            break;
          case 'compress':
            artifacts = await processCompress(operation, handleProgress, abortControllerRef.current?.signal);
            break;
          case 'split':
            artifacts = await processSplit(operation, handleProgress);
            break;
          case 'watermark':
            artifacts = await processWatermark(operation, handleProgress);
            break;
          case 'security':
            artifacts = await processSecurity(
              operation,
              handleProgress,
              abortControllerRef.current?.signal,
            );
            break;
          case 'ocr':
            artifacts = await processOCR(operation, handleProgress, abortControllerRef.current?.signal);
            break;
          case 'convert':
            artifacts = await processConvert(operation, handleProgress, abortControllerRef.current?.signal);
            break;
          case 'crop':
            artifacts = await processCrop(operation, handleProgress);
            break;
          case 'trim':
            artifacts = await processTrim(operation, handleProgress);
            break;
          case 'resize':
            artifacts = await processResize(operation, handleProgress);
            break;
          default:
            throw new Error(`Unsupported operation type: ${operation.type}`);
        }

        const processingTime = Date.now() - startTime;

        if (artifacts.length === 0) throw new Error('Operation produced no output artifacts');
        const firstArtifact = artifacts[0]!;
        const outputSize = artifacts.reduce((total, artifact) => total + artifact.data.byteLength, 0);

        const result: BatchOperationResult = {
          success: true,
          artifacts,
          data: firstArtifact.data,
          filename: firstArtifact.filename,
          processedAt: new Date(),
          processingTime,
          outputSize,
        };

        return result;
      } catch (error) {
        const processingTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';

        const result: BatchOperationResult = {
          success: false,
          error: errorMessage,
          processedAt: new Date(),
          processingTime,
        };

        return result;
      }
    },
    [updateOperationProgress]
  );

  /**
   * Process the queue
   */
  const processQueue = React.useCallback(async () => {
    if (isRunningRef.current) return;

    isRunningRef.current = true;
    setState((prev) => ({
      ...prev,
      isRunning: true,
      abortController: new AbortController(),
    }));
    abortControllerRef.current = new AbortController();

    try {
      while (isRunningRef.current) {
        // Check queue status
        const currentStatus = useBatchStore.getState().queueStatus;
        if (currentStatus === 'paused' || currentStatus === 'idle') {
          break;
        }

        // Get next pending operation
        const pending = useBatchStore.getState().queue.filter(
          (op) => op.status === 'pending'
        );

        if (pending.length === 0) {
          break;
        }

        const operation = pending[0];
        if (!operation) {
          break;
        }

        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        // Set as current and processing
        setCurrentOperation(operation.id);
        updateOperationStatus(operation.id, 'processing');
        setState((prev) => ({ ...prev, currentOperation: operation }));

        // Process the operation
        const result = await processOperation(operation);

        // Update status based on result
        if (result.success) {
          updateOperationStatus(operation.id, 'completed', result);
          onOperationComplete?.(operation, result);

          if (showToasts) {
            toast({
              title: 'Operation complete',
              description: `${operation.type} completed successfully`,
            });
          }

          // Store result in IndexedDB if enabled
          if (storeResults && result.artifacts?.length) {
            try {
              await db.saveLocalOperationResult({
                id: operation.id,
                operation: operation.type,
                artifacts: result.artifacts,
                completedAt: result.processedAt,
              });
            } catch (error) {
              if (showToasts) {
                toast({
                  title: 'Result not saved to library history',
                  description: error instanceof Error ? error.message : 'IndexedDB storage failed',
                  variant: 'destructive',
                });
              }
            }
          }
        } else {
          updateOperationStatus(operation.id, 'failed', result);
          onOperationFailed?.(operation, new Error(result.error ?? 'Unknown error'));

          if (showToasts) {
            toast({
              title: 'Operation failed',
              description: result.error ?? 'Unknown error',
              variant: 'destructive',
            });
          }
        }

        setCurrentOperation(null);
        setState((prev) => ({ ...prev, currentOperation: null }));
      }
    } finally {
      isRunningRef.current = false;
      setState((prev) => ({
        ...prev,
        isRunning: false,
        currentOperation: null,
        abortController: null,
      }));
      abortControllerRef.current = null;

      // Check if queue is complete
      const finalPending = useBatchStore.getState().queue.filter(
        (op) => op.status === 'pending'
      );
      if (finalPending.length === 0) {
        onQueueComplete?.();
        if (showToasts) {
          toast({
            title: 'Queue complete',
            description: 'All batch operations have been processed',
          });
        }
      }
    }
  }, [
    processOperation,
    setCurrentOperation,
    updateOperationStatus,
    onOperationComplete,
    onOperationFailed,
    onQueueComplete,
    showToasts,
    storeResults,
    toast,
  ]);

  /**
   * Start processing
   */
  const startProcessing = React.useCallback(() => {
    processQueue();
  }, [processQueue]);

  /**
   * Stop processing
   */
  const stopProcessing = React.useCallback(() => {
    isRunningRef.current = false;
  }, []);

  /**
   * Cancel current operation
   */
  const cancelCurrent = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (state.currentOperation) {
      updateOperationStatus(state.currentOperation.id, 'cancelled');
    }
  }, [state.currentOperation, updateOperationStatus]);

  // Auto-process when queue status changes to processing
  React.useEffect(() => {
    if (autoProcess && isQueueProcessing && !state.isRunning) {
      startProcessing();
    }
  }, [autoProcess, isQueueProcessing, state.isRunning, startProcessing]);

  return {
    state,
    startProcessing,
    stopProcessing,
    cancelCurrent,
    processOperation,
  };
}

/**
 * Selector hook for processor state
 */
export function useBatchProcessorState(): BatchProcessorState {
  const isRunning = useBatchStore(selectIsQueueProcessing);
  const currentOperation = useBatchStore((state) =>
    state.queue.find((op: BatchOperation) => op.id === state.currentOperationId) ?? null
  );

  return {
    isRunning,
    currentOperation,
    abortController: null, // Not exposed
  };
}
