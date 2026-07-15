/**
 * Operation History State Management
 * Manages operation history with undo/redo functionality for PDF operations
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

/**
 * Supported operation types
 */
export type OperationType =
  | 'merge'
  | 'split'
  | 'compress'
  | 'convert'
  | 'watermark'
  | 'security'
  | 'rotate'
  | 'crop'
  | 'resize'
  | 'reorder'
  | 'delete_pages'
  | 'extract_images'
  | 'extract_text'
  | 'ocr'
  | 'signature'
  | 'annotation'
  | 'edit'
  | 'other';

/**
 * Represents a single operation in history
 */
export interface HistoryEntry {
  /** Unique identifier */
  id: string;
  /** Type of operation */
  type: OperationType;
  /** Timestamp when operation was performed */
  timestamp: Date;
  /** Human-readable description */
  description: string;
  /** State before operation (for undo) - stored as Blob URL or serialized data */
  before?: string | null;
  /** State after operation (for redo) - stored as Blob URL or serialized data */
  after?: string | null;
  /** Whether this operation can be undone */
  canUndo: boolean;
  /** Associated document ID(s) */
  documentIds?: string[];
  /** File names involved */
  fileNames?: string[];
  /** Size of files involved */
  fileSize?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Serializable history entry for persistence
 */
interface SerializedHistoryEntry extends Omit<HistoryEntry, 'timestamp' | 'before' | 'after'> {
  timestamp: string;
  // before and after are not persisted to avoid storage bloat
}

/**
 * History store state interface
 */
export interface HistoryState {
  /** All history entries */
  history: HistoryEntry[];
  /** Current position in history for undo/redo navigation */
  currentIndex: number;
  /** Maximum number of history entries to keep */
  maxHistory: number;
  /** Whether history recording is enabled */
  isRecordingEnabled: boolean;
}

/**
 * History store actions interface
 */
export interface HistoryActions {
  /** Add a new entry to history */
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => string;
  /** Undo the last operation */
  undo: () => HistoryEntry | null;
  /** Redo the last undone operation */
  redo: () => HistoryEntry | null;
  /** Clear all history */
  clearHistory: () => void;
  /** Remove a specific entry */
  removeEntry: (id: string) => void;
  /** Set maximum history size */
  setMaxHistory: (max: number) => void;
  /** Toggle history recording */
  setRecordingEnabled: (enabled: boolean) => void;
  /** Get recent operations */
  getRecentOperations: (n: number) => HistoryEntry[];
  /** Clear entries older than specified date */
  clearOlderThan: (date: Date) => void;
  /** Clear entries in a range */
  clearRange: (startIndex: number, endIndex: number) => void;
  /** Update entry metadata */
  updateEntryMetadata: (id: string, metadata: Record<string, unknown>) => void;
  /** Mark entry as unable to undo (e.g., if state data was cleaned up) */
  markAsNonUndoable: (id: string) => void;
  /** Revoke blob URLs for memory cleanup */
  cleanupBlobUrls: () => void;
}

/**
 * Combined history store type
 */
export type HistoryStore = HistoryState & HistoryActions;

/**
 * Initial state for the history store
 */
const initialState: HistoryState = {
  history: [],
  currentIndex: -1,
  maxHistory: 50,
  isRecordingEnabled: true,
};

/**
 * Generate a unique ID
 */
function generateHistoryId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Serialize history for persistence (without large data)
 */
export function serializeHistory(history: HistoryEntry[]): SerializedHistoryEntry[] {
  return history.map((entry) => ({
    id: entry.id,
    type: entry.type,
    timestamp: entry.timestamp.toISOString(),
    description: entry.description,
    canUndo: Boolean(
      entry.canUndo &&
        entry.documentIds?.length === 1 &&
        typeof entry.metadata?.beforeVersionId === 'string' &&
        typeof entry.metadata?.afterVersionId === 'string',
    ),
    documentIds: entry.documentIds,
    fileNames: entry.fileNames,
    fileSize: entry.fileSize,
    metadata: entry.metadata,
  }));
}

/**
 * Deserialize history from persistence
 */
export function deserializeHistory(serialized: SerializedHistoryEntry[]): HistoryEntry[] {
  return serialized.map((entry) => ({
    ...entry,
    timestamp: new Date(entry.timestamp),
    before: null,
    after: null,
    canUndo: Boolean(
      entry.canUndo &&
        entry.documentIds?.length === 1 &&
        typeof entry.metadata?.beforeVersionId === 'string' &&
        typeof entry.metadata?.afterVersionId === 'string',
    ),
  }));
}

/**
 * Operation history store
 * Manages undo/redo functionality and operation tracking
 */
export const useHistoryStore = create<HistoryStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      addEntry: (entryData) => {
        const state = get();
        if (!state.isRecordingEnabled) {
          return '';
        }

        const id = generateHistoryId();
        const entry: HistoryEntry = {
          ...entryData,
          id,
          timestamp: new Date(),
        };

        set((state) => {
          // If we're not at the end of history, remove future entries
          if (state.currentIndex < state.history.length - 1) {
            // Clean up blob URLs for removed entries
            const removedEntries = state.history.slice(state.currentIndex + 1);
            removedEntries.forEach((e) => {
              if (e.before?.startsWith('blob:')) URL.revokeObjectURL(e.before);
              if (e.after?.startsWith('blob:')) URL.revokeObjectURL(e.after);
            });
            state.history = state.history.slice(0, state.currentIndex + 1);
          }

          // Add new entry
          state.history.push(entry);
          state.currentIndex = state.history.length - 1;

          // Enforce max history limit
          if (state.history.length > state.maxHistory) {
            const excess = state.history.length - state.maxHistory;
            // Clean up blob URLs for removed entries
            const removedEntries = state.history.slice(0, excess);
            removedEntries.forEach((e) => {
              if (e.before?.startsWith('blob:')) URL.revokeObjectURL(e.before);
              if (e.after?.startsWith('blob:')) URL.revokeObjectURL(e.after);
            });
            state.history = state.history.slice(excess);
            state.currentIndex = state.history.length - 1;
          }
        });

        return id;
      },

      undo: () => {
        const state = get();
        if (state.currentIndex < 0) return null;

        const entry = state.history[state.currentIndex];
        if (!entry || !entry.canUndo) return null;

        set((state) => {
          state.currentIndex--;
        });

        return entry;
      },

      redo: () => {
        const state = get();
        if (state.currentIndex >= state.history.length - 1) return null;

        const nextEntry = state.history[state.currentIndex + 1];
        if (!nextEntry) return null;

        set((state) => {
          state.currentIndex++;
        });

        return nextEntry;
      },

      clearHistory: () => {
        const state = get();
        // Clean up all blob URLs
        state.history.forEach((entry) => {
          if (entry.before?.startsWith('blob:')) URL.revokeObjectURL(entry.before);
          if (entry.after?.startsWith('blob:')) URL.revokeObjectURL(entry.after);
        });

        set((state) => {
          state.history = [];
          state.currentIndex = -1;
        });
      },

      removeEntry: (id) => {
        set((state) => {
          const index = state.history.findIndex((e) => e.id === id);
          if (index === -1) return;

          const entry = state.history[index];
          // Clean up blob URLs
          if (entry.before?.startsWith('blob:')) URL.revokeObjectURL(entry.before);
          if (entry.after?.startsWith('blob:')) URL.revokeObjectURL(entry.after);

          state.history = state.history.filter((e) => e.id !== id);
          // Adjust current index
          if (index <= state.currentIndex) {
            state.currentIndex = Math.max(-1, state.currentIndex - 1);
          }
        });
      },

      setMaxHistory: (max) => {
        set((state) => {
          state.maxHistory = Math.max(1, max);
          // Enforce new limit
          if (state.history.length > state.maxHistory) {
            const excess = state.history.length - state.maxHistory;
            const removedEntries = state.history.slice(0, excess);
            removedEntries.forEach((e) => {
              if (e.before?.startsWith('blob:')) URL.revokeObjectURL(e.before);
              if (e.after?.startsWith('blob:')) URL.revokeObjectURL(e.after);
            });
            state.history = state.history.slice(excess);
            state.currentIndex = Math.min(state.currentIndex, state.history.length - 1);
          }
        });
      },

      setRecordingEnabled: (enabled) => {
        set((state) => {
          state.isRecordingEnabled = enabled;
        });
      },

      getRecentOperations: (n) => {
        const state = get();
        return state.history.slice(-n).reverse();
      },

      clearOlderThan: (date) => {
        set((state) => {
          const cutoffTime = date.getTime();
          const toRemove = state.history.filter((e) => e.timestamp.getTime() < cutoffTime);
          toRemove.forEach((e) => {
            if (e.before?.startsWith('blob:')) URL.revokeObjectURL(e.before);
            if (e.after?.startsWith('blob:')) URL.revokeObjectURL(e.after);
          });

          const oldLength = state.history.length;
          state.history = state.history.filter((e) => e.timestamp.getTime() >= cutoffTime);
          const removed = oldLength - state.history.length;
          state.currentIndex = Math.max(-1, state.currentIndex - removed);
        });
      },

      clearRange: (startIndex, endIndex) => {
        set((state) => {
          const start = Math.max(0, startIndex);
          const end = Math.min(state.history.length, endIndex + 1);

          // Clean up blob URLs for removed entries
          for (let i = start; i < end; i++) {
            const entry = state.history[i];
            if (entry.before?.startsWith('blob:')) URL.revokeObjectURL(entry.before);
            if (entry.after?.startsWith('blob:')) URL.revokeObjectURL(entry.after);
          }

          state.history = [
            ...state.history.slice(0, start),
            ...state.history.slice(end),
          ];

          // Adjust current index
          if (state.currentIndex >= start && state.currentIndex <= endIndex) {
            state.currentIndex = start - 1;
          } else if (state.currentIndex > endIndex) {
            state.currentIndex -= end - start;
          }
          state.currentIndex = Math.max(-1, state.currentIndex);
        });
      },

      updateEntryMetadata: (id, metadata) => {
        set((state) => {
          const entry = state.history.find((e) => e.id === id);
          if (entry) {
            entry.metadata = { ...entry.metadata, ...metadata };
          }
        });
      },

      markAsNonUndoable: (id) => {
        set((state) => {
          const entry = state.history.find((e) => e.id === id);
          if (entry) {
            // Clean up blob URLs
            if (entry.before?.startsWith('blob:')) {
              URL.revokeObjectURL(entry.before);
              entry.before = null;
            }
            if (entry.after?.startsWith('blob:')) {
              URL.revokeObjectURL(entry.after);
              entry.after = null;
            }
            entry.canUndo = false;
          }
        });
      },

      cleanupBlobUrls: () => {
        set((state) => {
          state.history.forEach((entry) => {
            if (entry.before?.startsWith('blob:')) {
              URL.revokeObjectURL(entry.before);
              entry.before = null;
            }
            if (entry.after?.startsWith('blob:')) {
              URL.revokeObjectURL(entry.after);
              entry.after = null;
            }
            entry.canUndo = false;
          });
        });
      },
    })),
    {
      name: 'pdflover-history',
      version: 1,
      partialize: (state) => ({
        history: serializeHistory(state.history),
        maxHistory: state.maxHistory,
        isRecordingEnabled: state.isRecordingEnabled,
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as {
          history?: SerializedHistoryEntry[];
          maxHistory?: number;
          isRecordingEnabled?: boolean;
        };
        return {
          ...current,
          history: persistedState.history
            ? deserializeHistory(persistedState.history)
            : current.history,
          currentIndex: persistedState.history
            ? persistedState.history.length - 1
            : current.currentIndex,
          maxHistory: persistedState.maxHistory ?? current.maxHistory,
          isRecordingEnabled: persistedState.isRecordingEnabled ?? current.isRecordingEnabled,
        };
      },
    }
  )
);

/**
 * Selector: Check if undo is available
 */
export const selectCanUndo = (state: HistoryStore): boolean => {
  if (state.currentIndex < 0) return false;
  const entry = state.history[state.currentIndex];
  return entry?.canUndo ?? false;
};

/**
 * Selector: Check if redo is available
 */
export const selectCanRedo = (state: HistoryStore): boolean => {
  return state.currentIndex < state.history.length - 1;
};

/**
 * Selector: Get current entry
 */
export const selectCurrentEntry = (state: HistoryStore): HistoryEntry | null => {
  if (state.currentIndex < 0 || state.currentIndex >= state.history.length) {
    return null;
  }
  return state.history[state.currentIndex] ?? null;
};

/**
 * Selector: Get history count
 */
export const selectHistoryCount = (state: HistoryStore): number => {
  return state.history.length;
};

/**
 * Selector: Get undo count (how many undos are available)
 */
export const selectUndoAvailable = (state: HistoryStore): number => {
  let count = 0;
  for (let i = state.currentIndex; i >= 0; i--) {
    if (state.history[i]?.canUndo) count++;
  }
  return count;
};

/**
 * Selector: Get redo count (how many redos are available)
 */
export const selectRedoAvailable = (state: HistoryStore): number => {
  return state.history.length - 1 - state.currentIndex;
};

/**
 * Selector: Get operations by type
 */
export const selectOperationsByType =
  (type: OperationType) =>
  (state: HistoryStore): HistoryEntry[] => {
    return state.history.filter((entry) => entry.type === type);
  };

/**
 * Selector: Get operations for a document
 */
export const selectOperationsForDocument =
  (documentId: string) =>
  (state: HistoryStore): HistoryEntry[] => {
    return state.history.filter((entry) => entry.documentIds?.includes(documentId));
  };

/**
 * Get operation type display label
 */
export function getOperationTypeLabel(type: OperationType): string {
  const labels: Record<OperationType, string> = {
    merge: 'Merge',
    split: 'Split',
    compress: 'Compress',
    convert: 'Convert',
    watermark: 'Watermark',
    security: 'Security',
    rotate: 'Rotate',
    crop: 'Crop',
    resize: 'Resize',
    reorder: 'Reorder',
    delete_pages: 'Delete Pages',
    extract_images: 'Extract Images',
    extract_text: 'Extract Text',
    ocr: 'OCR',
    signature: 'Signature',
    annotation: 'Annotation',
    edit: 'Edit',
    other: 'Other',
  };
  return labels[type] ?? 'Unknown';
}
