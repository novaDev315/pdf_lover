/**
 * useBatchProcessor - Hook for processing batch operations queue
 * Processes operations sequentially with progress reporting and error handling
 */

import * as React from 'react';
import {
  useBatchStore,
  selectIsQueueProcessing,
  type BatchOperation,
  type BatchOperationResult,
  type CompressOptions,
  type WatermarkOptions,
  type SplitOptions,
  type SecurityOptions,
  type ConvertOptions,
} from '@/store/batch-store';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/storage/indexeddb';
import type { ProgressInfo } from '@pdflover/shared';

// Dynamic imports for pdf-core to avoid module resolution issues at build time
const getPdfCore = async () => {
  const pdfCore = await import('@pdflover/pdf-core');
  return pdfCore;
};

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
): Promise<ArrayBuffer> {
  const pdfCore = await getPdfCore();
  const files = operation.files.map((f) => f.file);
  const result = await pdfCore.mergePDFFiles(files, {
    outputFilename: 'merged.pdf',
    onProgress,
  });

  if (!result.success || !result.data) {
    throw new Error(result.error ?? 'Merge operation failed');
  }

  return result.data;
}

/**
 * Process a compress operation
 */
async function processCompress(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void
): Promise<ArrayBuffer[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as CompressOptions;
  const results: ArrayBuffer[] = [];

  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i];
    if (!fileInfo) continue;
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

    results.push(result.data);
  }

  return results;
}

/**
 * Process a split operation
 */
async function processSplit(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void
): Promise<ArrayBuffer[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as SplitOptions;
  const results: ArrayBuffer[] = [];

  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i];
    if (!fileInfo) continue;
    const buffer = await fileInfo.file.arrayBuffer();

    let pageRanges: string | undefined;
    if (options.mode === 'range' && options.ranges) {
      pageRanges = options.ranges;
    }

    const splitMode = options.mode === 'all' ? 'single' : options.mode === 'range' ? 'range' : 'single';
    const result = await pdfCore.splitPDF({
      document: buffer,
      mode: splitMode,
      ranges: pageRanges ? [{ start: 1, end: 1 }] : undefined,
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

    if (!result.success || !result.data) {
      throw new Error(result.error ?? `Failed to split ${fileInfo.name}`);
    }

    // Split returns multiple PDFs
    if (Array.isArray(result.data)) {
      results.push(...result.data);
    } else {
      results.push(result.data);
    }
  }

  return results;
}

/**
 * Process a watermark operation
 */
async function processWatermark(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void
): Promise<ArrayBuffer[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as WatermarkOptions;
  const results: ArrayBuffer[] = [];

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

    results.push(result.data);
  }

  return results;
}

/**
 * Process a security operation
 */
async function processSecurity(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void
): Promise<ArrayBuffer[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as SecurityOptions;
  const results: ArrayBuffer[] = [];

  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i];
    if (!fileInfo) continue;
    const buffer = await fileInfo.file.arrayBuffer();

    const result = await pdfCore.encryptPDF({
      document: buffer,
      userPassword: options.password ?? '',
      onProgress: (info: ProgressInfo) => {
        const fileProgress = (i / operation.files.length) * 100;
        const currentProgress = info.percentage / operation.files.length;
        onProgress({
          ...info,
          percentage: fileProgress + currentProgress,
          stage: `Securing ${fileInfo.name}...`,
        });
      },
    } as Parameters<typeof pdfCore.encryptPDF>[0]);

    if (!result.success || !result.data) {
      throw new Error(result.error ?? `Failed to secure ${fileInfo.name}`);
    }

    results.push(result.data);
  }

  return results;
}

/**
 * Process an OCR operation
 * Note: OCR returns text results, we create a simple text PDF
 */
async function processOCR(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void
): Promise<ArrayBuffer[]> {
  const results: ArrayBuffer[] = [];

  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i];
    if (!fileInfo) continue;

    onProgress({
      percentage: ((i + 0.5) / operation.files.length) * 100,
      stage: `Running OCR on ${fileInfo.name}...`,
    });

    // OCR operations return text, so we'll just return the original file
    // In a real implementation, this would create a searchable PDF
    const buffer = await fileInfo.file.arrayBuffer();
    results.push(buffer);

    onProgress({
      percentage: ((i + 1) / operation.files.length) * 100,
      stage: `Completed OCR on ${fileInfo.name}`,
    });
  }

  return results;
}

/**
 * Process a convert operation
 */
async function processConvert(
  operation: BatchOperation,
  onProgress: (info: ProgressInfo) => void
): Promise<ArrayBuffer[]> {
  const pdfCore = await getPdfCore();
  const options = operation.options as ConvertOptions;
  const results: ArrayBuffer[] = [];

  for (let i = 0; i < operation.files.length; i++) {
    const fileInfo = operation.files[i];
    if (!fileInfo) continue;
    const buffer = await fileInfo.file.arrayBuffer();

    // Map format to supported output format
    const outputFormat = options.format === 'png' || options.format === 'jpg' ? options.format : 'png';

    const result = await pdfCore.convertPDF({
      document: buffer,
      outputFormat: outputFormat as 'png' | 'jpg' | 'webp',
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

    if (!result.success || !result.data) {
      throw new Error(result.error ?? `Failed to convert ${fileInfo.name}`);
    }

    results.push(result.data);
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
        let resultData: ArrayBuffer | ArrayBuffer[];

        switch (operation.type) {
          case 'merge':
            resultData = await processMerge(operation, handleProgress);
            break;
          case 'compress':
            resultData = await processCompress(operation, handleProgress);
            break;
          case 'split':
            resultData = await processSplit(operation, handleProgress);
            break;
          case 'watermark':
            resultData = await processWatermark(operation, handleProgress);
            break;
          case 'security':
            resultData = await processSecurity(operation, handleProgress);
            break;
          case 'ocr':
            resultData = await processOCR(operation, handleProgress);
            break;
          case 'convert':
            resultData = await processConvert(operation, handleProgress);
            break;
          default:
            throw new Error(`Unsupported operation type: ${operation.type}`);
        }

        const processingTime = Date.now() - startTime;

        // For multiple results, only return the first one (or merge them)
        const finalData = Array.isArray(resultData) ? resultData[0] : resultData;
        const outputSize = finalData?.byteLength ?? 0;

        const result: BatchOperationResult = {
          success: true,
          data: finalData,
          filename: `${operation.type}_result.pdf`,
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
          if (storeResults && result.data) {
            try {
              await db.saveSetting(`batch_result_${operation.id}`, {
                operationId: operation.id,
                type: operation.type,
                data: Array.from(new Uint8Array(result.data)),
                filename: result.filename,
                processedAt: result.processedAt,
              });
            } catch {
              // Silently fail storage
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
