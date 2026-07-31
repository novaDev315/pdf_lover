/**
 * Batch Operations Queue Store
 * Manages batch PDF operations queue for sequential processing
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

/**
 * Available batch operation types
 */
export type BatchOperationType =
  | 'merge'
  | 'compress'
  | 'convert'
  | 'watermark'
  | 'split'
  | 'ocr'
  | 'security'
  | 'crop'
  | 'trim'
  | 'resize';

/**
 * Status of a batch operation
 */
export type BatchOperationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Options for different operation types
 */
export interface MergeOptions {
  outputFilename?: string;
}

export interface CompressOptions {
  level: 'low' | 'medium' | 'high' | 'maximum';
  serverConsent?: boolean;
}

export interface ConvertOptions {
  format: 'png' | 'jpg' | 'jpeg' | 'webp' | 'svg' | 'txt' | 'html' | 'docx' | 'xlsx' | 'pptx';
  quality?: number;
  serverConsent?: boolean;
}

export interface WatermarkOptions {
  text: string;
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'diagonal';
  opacity: number;
  fontSize: number;
  color: string;
  rotation: number;
}

export interface SplitOptions {
  mode: 'all' | 'range' | 'even' | 'odd';
  ranges?: string;
}

export interface OCROptions {
  language: string;
  enhanceScans: boolean;
  engine?: 'local' | 'server';
  serverConsent?: boolean;
}

export interface SecurityOptions {
  userPassword?: string;
  ownerPassword?: string;
  permissions?: {
    print: boolean;
    copy: boolean;
    modify: boolean;
  };
  serverConsent?: boolean;
}

export interface TrimOptions {
  threshold?: number;
  padding?: number;
  uniformPadding?: boolean;
}

export interface CropOptions {
  cropMode: 'percentage' | 'absolute';
  boxType: 'MediaBox' | 'CropBox' | 'TrimBox' | 'BleedBox';
  cropPercent?: { left: number; right: number; top: number; bottom: number };
  cropBox?: { x: number; y: number; width: number; height: number };
}

export interface ResizeOptions {
  resizeMode?: 'preset' | 'custom';
  preset?: string;
  orientation?: 'portrait' | 'landscape';
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
  scaleContent?: boolean;
  centerContent?: boolean;
}

export type BatchOperationOptions =
  | MergeOptions
  | CompressOptions
  | ConvertOptions
  | WatermarkOptions
  | SplitOptions
  | OCROptions
  | SecurityOptions
  | CropOptions
  | TrimOptions
  | ResizeOptions;

/**
 * File info stored in batch operation
 */
export interface BatchFileInfo {
  id: string;
  name: string;
  size: number;
  file: File;
}

/**
 * Result of a completed operation
 */
export interface BatchOperationResult {
  success: boolean;
  /** All output artifacts produced by the operation. */
  artifacts?: BatchOperationArtifact[];
  /** First artifact data retained for older result consumers. */
  data?: ArrayBuffer;
  filename?: string;
  error?: string;
  processedAt: Date;
  processingTime: number;
  outputSize?: number;
}

export interface BatchOperationArtifact {
  data: ArrayBuffer;
  filename: string;
  mediaType: string;
}

/**
 * Batch operation interface
 */
export interface BatchOperation {
  id: string;
  type: BatchOperationType;
  files: BatchFileInfo[];
  options: BatchOperationOptions;
  status: BatchOperationStatus;
  progress: number;
  progressStage?: string;
  result?: BatchOperationResult;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Queue status for the entire batch
 */
export type QueueStatus = 'idle' | 'processing' | 'paused' | 'completed';

/**
 * Batch store state interface
 */
export interface BatchState {
  /** Queue of batch operations */
  queue: BatchOperation[];
  /** Current queue processing status */
  queueStatus: QueueStatus;
  /** ID of currently processing operation */
  currentOperationId: string | null;
  /** Overall queue progress (0-100) */
  overallProgress: number;
  /** Whether the batch panel is open */
  isPanelOpen: boolean;
}

/**
 * Batch store actions interface
 */
export interface BatchActions {
  /** Add an operation to the queue */
  addToQueue: (operation: Omit<BatchOperation, 'id' | 'status' | 'progress' | 'createdAt'>) => string;
  /** Remove an operation from the queue */
  removeFromQueue: (id: string) => void;
  /** Clear all operations from the queue */
  clearQueue: () => void;
  /** Clear completed operations from the queue */
  clearCompleted: () => void;
  /** Start processing the queue */
  startQueue: () => void;
  /** Pause queue processing */
  pauseQueue: () => void;
  /** Resume queue processing */
  resumeQueue: () => void;
  /** Cancel a specific operation */
  cancelOperation: (id: string) => void;
  /** Get operation by ID */
  getOperationById: (id: string) => BatchOperation | undefined;
  /** Update operation progress */
  updateOperationProgress: (id: string, progress: number, stage?: string) => void;
  /** Update operation status */
  updateOperationStatus: (id: string, status: BatchOperationStatus, result?: BatchOperationResult) => void;
  /** Set current processing operation */
  setCurrentOperation: (id: string | null) => void;
  /** Reorder operations in the queue */
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  /** Move operation to a specific position */
  moveOperation: (id: string, newIndex: number) => void;
  /** Toggle panel visibility */
  togglePanel: () => void;
  /** Set panel open state */
  setPanelOpen: (open: boolean) => void;
  /** Calculate overall progress */
  calculateOverallProgress: () => void;
  /** Retry a failed operation */
  retryOperation: (id: string) => void;
}

/**
 * Combined batch store type
 */
export type BatchStore = BatchState & BatchActions;

/**
 * Generate unique ID for operations
 */
function generateOperationId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Initial state for the batch store
 */
const initialState: BatchState = {
  queue: [],
  queueStatus: 'idle',
  currentOperationId: null,
  overallProgress: 0,
  isPanelOpen: false,
};

/**
 * Batch operations store
 * Manages the queue of PDF batch operations
 */
export const useBatchStore = create<BatchStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      addToQueue: (operation) => {
        const id = generateOperationId();
        set((state) => {
          const newOperation: BatchOperation = {
            ...operation,
            id,
            status: 'pending',
            progress: 0,
            createdAt: new Date(),
          };
          state.queue.push(newOperation);
        });
        return id;
      },

      removeFromQueue: (id: string) => {
        set((state) => {
          const index = state.queue.findIndex((op: BatchOperation) => op.id === id);
          if (index !== -1) {
            // Don't remove if currently processing
            if (state.queue[index]?.status === 'processing') {
              return;
            }
            state.queue.splice(index, 1);
          }
        });
        get().calculateOverallProgress();
      },

      clearQueue: () => {
        set((state) => {
          // Only clear non-processing operations
          state.queue = state.queue.filter((op: BatchOperation) => op.status === 'processing');
          if (state.queue.length === 0) {
            state.queueStatus = 'idle';
            state.currentOperationId = null;
          }
        });
        get().calculateOverallProgress();
      },

      clearCompleted: () => {
        set((state) => {
          state.queue = state.queue.filter(
            (op: BatchOperation) => op.status !== 'completed' && op.status !== 'failed'
          );
        });
        get().calculateOverallProgress();
      },

      startQueue: () => {
        set((state) => {
          if (state.queue.some((op: BatchOperation) => op.status === 'pending')) {
            state.queueStatus = 'processing';
          }
        });
      },

      pauseQueue: () => {
        set((state) => {
          if (state.queueStatus === 'processing') {
            state.queueStatus = 'paused';
          }
        });
      },

      resumeQueue: () => {
        set((state) => {
          if (state.queueStatus === 'paused') {
            state.queueStatus = 'processing';
          }
        });
      },

      cancelOperation: (id: string) => {
        set((state) => {
          const operation = state.queue.find((op: BatchOperation) => op.id === id);
          if (operation && (operation.status === 'pending' || operation.status === 'processing')) {
            operation.status = 'cancelled';
            operation.completedAt = new Date();
            if (state.currentOperationId === id) {
              state.currentOperationId = null;
            }
          }
        });
        get().calculateOverallProgress();
      },

      getOperationById: (id: string) => {
        return get().queue.find((op: BatchOperation) => op.id === id);
      },

      updateOperationProgress: (id: string, progress: number, stage?: string) => {
        set((state) => {
          const operation = state.queue.find((op: BatchOperation) => op.id === id);
          if (operation) {
            operation.progress = Math.min(100, Math.max(0, progress));
            if (stage !== undefined) {
              operation.progressStage = stage;
            }
          }
        });
        get().calculateOverallProgress();
      },

      updateOperationStatus: (id: string, status: BatchOperationStatus, result?: BatchOperationResult) => {
        set((state) => {
          const operation = state.queue.find((op: BatchOperation) => op.id === id);
          if (operation) {
            operation.status = status;
            if (result) {
              operation.result = result;
            }
            if (status === 'processing' && !operation.startedAt) {
              operation.startedAt = new Date();
            }
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
              operation.completedAt = new Date();
              operation.progress = status === 'completed' ? 100 : operation.progress;
            }
          }

          // Check if all operations are done
          const allDone = state.queue.every(
            (op: BatchOperation) => op.status === 'completed' || op.status === 'failed' || op.status === 'cancelled'
          );
          if (allDone && state.queue.length > 0) {
            state.queueStatus = 'completed';
            state.currentOperationId = null;
          }
        });
        get().calculateOverallProgress();
      },

      setCurrentOperation: (id: string | null) => {
        set((state) => {
          state.currentOperationId = id;
        });
      },

      reorderQueue: (fromIndex: number, toIndex: number) => {
        set((state) => {
          if (
            fromIndex < 0 ||
            fromIndex >= state.queue.length ||
            toIndex < 0 ||
            toIndex >= state.queue.length
          ) {
            return;
          }

          // Don't allow reordering processing items
          if (state.queue[fromIndex].status === 'processing') {
            return;
          }

          const [removed] = state.queue.splice(fromIndex, 1);
          state.queue.splice(toIndex, 0, removed);
        });
      },

      moveOperation: (id: string, newIndex: number) => {
        const { queue } = get();
        const currentIndex = queue.findIndex((op) => op.id === id);
        if (currentIndex !== -1) {
          get().reorderQueue(currentIndex, newIndex);
        }
      },

      togglePanel: () => {
        set((state) => {
          state.isPanelOpen = !state.isPanelOpen;
        });
      },

      setPanelOpen: (open: boolean) => {
        set((state) => {
          state.isPanelOpen = open;
        });
      },

      calculateOverallProgress: () => {
        set((state) => {
          if (state.queue.length === 0) {
            state.overallProgress = 0;
            return;
          }

          const totalProgress = state.queue.reduce((sum: number, op: BatchOperation) => {
            if (op.status === 'completed') return sum + 100;
            if (op.status === 'failed' || op.status === 'cancelled') return sum + 100;
            return sum + op.progress;
          }, 0);

          state.overallProgress = Math.round(totalProgress / state.queue.length);
        });
      },

      retryOperation: (id: string) => {
        set((state) => {
          const operation = state.queue.find((op: BatchOperation) => op.id === id);
          if (operation && (operation.status === 'failed' || operation.status === 'cancelled')) {
            operation.status = 'pending';
            operation.progress = 0;
            operation.progressStage = undefined;
            operation.result = undefined;
            operation.startedAt = undefined;
            operation.completedAt = undefined;
          }
        });
        get().calculateOverallProgress();
      },
    })),
    {
      name: 'pdflover-batch-store',
      partialize: (state) => ({
        // A File cannot be reconstructed from localStorage metadata. Persisting
        // a queue without its bytes creates operations that can never resume.
        isPanelOpen: state.isPanelOpen,
      }),
    }
  )
);

/**
 * Selector: Get pending operations
 */
export const selectPendingOperations = (state: BatchStore) =>
  state.queue.filter((op) => op.status === 'pending');

/**
 * Selector: Get completed operations
 */
export const selectCompletedOperations = (state: BatchStore) =>
  state.queue.filter((op) => op.status === 'completed');

/**
 * Selector: Get failed operations
 */
export const selectFailedOperations = (state: BatchStore) =>
  state.queue.filter((op) => op.status === 'failed');

/**
 * Selector: Get current operation
 */
export const selectCurrentOperation = (state: BatchStore) =>
  state.queue.find((op) => op.id === state.currentOperationId);

/**
 * Selector: Get queue statistics
 */
export const selectQueueStats = (state: BatchStore) => {
  const pending = state.queue.filter((op) => op.status === 'pending').length;
  const processing = state.queue.filter((op) => op.status === 'processing').length;
  const completed = state.queue.filter((op) => op.status === 'completed').length;
  const failed = state.queue.filter((op) => op.status === 'failed').length;
  const cancelled = state.queue.filter((op) => op.status === 'cancelled').length;

  return {
    total: state.queue.length,
    pending,
    processing,
    completed,
    failed,
    cancelled,
  };
};

/**
 * Selector: Check if queue has items
 */
export const selectHasQueueItems = (state: BatchStore) => state.queue.length > 0;

/**
 * Selector: Check if queue is processing
 */
export const selectIsQueueProcessing = (state: BatchStore) =>
  state.queueStatus === 'processing';

/**
 * Get operation type display label
 */
export function getOperationTypeLabel(type: BatchOperationType): string {
  const labels: Record<BatchOperationType, string> = {
    merge: 'Merge',
    compress: 'Compress',
    convert: 'Convert',
    watermark: 'Watermark',
    split: 'Split',
    ocr: 'OCR',
    security: 'Security',
    crop: 'Crop',
    trim: 'Trim Margins',
    resize: 'Resize',
  };
  return labels[type];
}

/**
 * Get operation status display label
 */
export function getOperationStatusLabel(status: BatchOperationStatus): string {
  const labels: Record<BatchOperationStatus, string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };
  return labels[status];
}
