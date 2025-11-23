/**
 * useOperationHistory Hook
 * Provides convenient methods for recording operations and managing undo/redo
 */

import { useCallback, useEffect } from 'react';
import {
  useHistoryStore,
  selectCanUndo,
  selectCanRedo,
  selectHistoryCount,
  selectUndoAvailable,
  selectRedoAvailable,
  type OperationType,
  type HistoryEntry,
} from '@/store/history-store';
import { useToast } from './use-toast';

/**
 * Options for recording an operation
 */
export interface RecordOperationOptions {
  /** Type of operation */
  type: OperationType;
  /** Human-readable description */
  description: string;
  /** State before operation (Blob or ArrayBuffer) */
  before?: Blob | ArrayBuffer | null;
  /** State after operation (Blob or ArrayBuffer) */
  after?: Blob | ArrayBuffer | null;
  /** Whether this operation can be undone */
  canUndo?: boolean;
  /** Associated document IDs */
  documentIds?: string[];
  /** File names involved */
  fileNames?: string[];
  /** Size of files involved */
  fileSize?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of an undo operation
 */
export interface UndoResult {
  /** Whether undo was successful */
  success: boolean;
  /** The entry that was undone */
  entry: HistoryEntry | null;
  /** The before state as Blob (if available) */
  beforeBlob: Blob | null;
}

/**
 * Result of a redo operation
 */
export interface RedoResult {
  /** Whether redo was successful */
  success: boolean;
  /** The entry that was redone */
  entry: HistoryEntry | null;
  /** The after state as Blob (if available) */
  afterBlob: Blob | null;
}

/**
 * Options for the useOperationHistory hook
 */
export interface UseOperationHistoryOptions {
  /** Show toast notifications on undo/redo */
  showToasts?: boolean;
  /** Enable keyboard shortcuts (Ctrl+Z, Ctrl+Y) */
  enableKeyboardShortcuts?: boolean;
}

/**
 * Return type for useOperationHistory hook
 */
export interface UseOperationHistoryReturn {
  /** Record a new operation */
  recordOperation: (options: RecordOperationOptions) => string;
  /** Undo the last undoable operation */
  undoLastOperation: () => Promise<UndoResult>;
  /** Redo the last undone operation */
  redoLastOperation: () => Promise<RedoResult>;
  /** Clear all history */
  clearHistory: () => void;
  /** Get recent operations */
  getRecentOperations: (n?: number) => HistoryEntry[];
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Total number of history entries */
  historyCount: number;
  /** Number of undoable operations */
  undoCount: number;
  /** Number of redoable operations */
  redoCount: number;
  /** All history entries */
  history: HistoryEntry[];
  /** Current history index */
  currentIndex: number;
  /** Enable/disable history recording */
  setRecordingEnabled: (enabled: boolean) => void;
  /** Whether recording is enabled */
  isRecordingEnabled: boolean;
}

/**
 * Convert data to Blob URL for storage
 */
function createBlobUrl(data: Blob | ArrayBuffer | null | undefined): string | null {
  if (!data) return null;
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

/**
 * Fetch Blob from URL
 */
async function fetchBlobFromUrl(url: string | null | undefined): Promise<Blob | null> {
  if (!url || !url.startsWith('blob:')) return null;
  try {
    const response = await fetch(url);
    return await response.blob();
  } catch (error) {
    console.error('Failed to fetch blob from URL:', error);
    return null;
  }
}

/**
 * Hook for managing operation history with undo/redo functionality
 *
 * @example
 * ```tsx
 * function MergePanel() {
 *   const { recordOperation, undoLastOperation, canUndo } = useOperationHistory({
 *     showToasts: true,
 *     enableKeyboardShortcuts: true,
 *   });
 *
 *   const handleMerge = async () => {
 *     const beforeState = await getCurrentPdfAsBlob();
 *     // ... perform merge ...
 *     const afterState = await getMergedPdfAsBlob();
 *
 *     recordOperation({
 *       type: 'merge',
 *       description: 'Merged 3 PDFs into one document',
 *       before: beforeState,
 *       after: afterState,
 *       canUndo: true,
 *       fileNames: ['doc1.pdf', 'doc2.pdf', 'doc3.pdf'],
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleMerge}>Merge</button>
 *       <button onClick={undoLastOperation} disabled={!canUndo}>Undo</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOperationHistory(
  options: UseOperationHistoryOptions = {}
): UseOperationHistoryReturn {
  const { showToasts = true, enableKeyboardShortcuts = true } = options;

  const { toast } = useToast();

  // Store state and actions
  const addEntry = useHistoryStore((state) => state.addEntry);
  const undo = useHistoryStore((state) => state.undo);
  const redo = useHistoryStore((state) => state.redo);
  const clearHistoryAction = useHistoryStore((state) => state.clearHistory);
  const getRecentOps = useHistoryStore((state) => state.getRecentOperations);
  const setRecordingEnabled = useHistoryStore((state) => state.setRecordingEnabled);
  const history = useHistoryStore((state) => state.history);
  const currentIndex = useHistoryStore((state) => state.currentIndex);
  const isRecordingEnabled = useHistoryStore((state) => state.isRecordingEnabled);

  // Computed selectors
  const canUndo = useHistoryStore(selectCanUndo);
  const canRedo = useHistoryStore(selectCanRedo);
  const historyCount = useHistoryStore(selectHistoryCount);
  const undoCount = useHistoryStore(selectUndoAvailable);
  const redoCount = useHistoryStore(selectRedoAvailable);

  /**
   * Record a new operation to history
   */
  const recordOperation = useCallback(
    (operationOptions: RecordOperationOptions): string => {
      const {
        type,
        description,
        before,
        after,
        canUndo = false,
        documentIds,
        fileNames,
        fileSize,
        metadata,
      } = operationOptions;

      const entry: Omit<HistoryEntry, 'id' | 'timestamp'> = {
        type,
        description,
        before: createBlobUrl(before),
        after: createBlobUrl(after),
        canUndo: canUndo && (before !== null || after !== null),
        documentIds,
        fileNames,
        fileSize,
        metadata,
      };

      const id = addEntry(entry);

      if (showToasts && id) {
        toast({
          title: 'Operation recorded',
          description: description,
          duration: 2000,
        });
      }

      return id;
    },
    [addEntry, showToasts, toast]
  );

  /**
   * Undo the last operation
   */
  const undoLastOperation = useCallback(async (): Promise<UndoResult> => {
    const entry = undo();

    if (!entry) {
      if (showToasts) {
        toast({
          title: 'Nothing to undo',
          description: 'No undoable operations in history',
          variant: 'destructive',
          duration: 2000,
        });
      }
      return { success: false, entry: null, beforeBlob: null };
    }

    const beforeBlob = await fetchBlobFromUrl(entry.before);

    if (showToasts) {
      toast({
        title: 'Undone',
        description: `Reverted: ${entry.description}`,
        duration: 2000,
      });
    }

    return { success: true, entry, beforeBlob };
  }, [undo, showToasts, toast]);

  /**
   * Redo the last undone operation
   */
  const redoLastOperation = useCallback(async (): Promise<RedoResult> => {
    const entry = redo();

    if (!entry) {
      if (showToasts) {
        toast({
          title: 'Nothing to redo',
          description: 'No operations to redo',
          variant: 'destructive',
          duration: 2000,
        });
      }
      return { success: false, entry: null, afterBlob: null };
    }

    const afterBlob = await fetchBlobFromUrl(entry.after);

    if (showToasts) {
      toast({
        title: 'Redone',
        description: `Restored: ${entry.description}`,
        duration: 2000,
      });
    }

    return { success: true, entry, afterBlob };
  }, [redo, showToasts, toast]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    clearHistoryAction();
    if (showToasts) {
      toast({
        title: 'History cleared',
        description: 'All operation history has been cleared',
        duration: 2000,
      });
    }
  }, [clearHistoryAction, showToasts, toast]);

  /**
   * Get recent operations
   */
  const getRecentOperations = useCallback(
    (n: number = 10): HistoryEntry[] => {
      return getRecentOps(n);
    },
    [getRecentOps]
  );

  /**
   * Handle keyboard shortcuts for undo/redo
   */
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // Ctrl+Z for undo
      if (isCtrlOrCmd && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoLastOperation();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z for redo
      if (
        isCtrlOrCmd &&
        (event.key === 'y' || (event.key === 'z' && event.shiftKey))
      ) {
        event.preventDefault();
        redoLastOperation();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, undoLastOperation, redoLastOperation]);

  return {
    recordOperation,
    undoLastOperation,
    redoLastOperation,
    clearHistory,
    getRecentOperations,
    canUndo,
    canRedo,
    historyCount,
    undoCount,
    redoCount,
    history,
    currentIndex,
    setRecordingEnabled,
    isRecordingEnabled,
  };
}

/**
 * Simple hook to just access history state without options
 */
export function useHistoryState() {
  const history = useHistoryStore((state) => state.history);
  const currentIndex = useHistoryStore((state) => state.currentIndex);
  const canUndo = useHistoryStore(selectCanUndo);
  const canRedo = useHistoryStore(selectCanRedo);
  const historyCount = useHistoryStore(selectHistoryCount);

  return {
    history,
    currentIndex,
    canUndo,
    canRedo,
    historyCount,
  };
}

export default useOperationHistory;
