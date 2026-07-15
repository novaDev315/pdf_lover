/**
 * Annotation State Management
 * Manages PDF annotations, editing tools, and undo/redo history
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * Rectangle definition for positioning annotations
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Point definition for drawing paths
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Color definition (RGB values 0-1)
 */
export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Annotation types
 */
export type AnnotationType =
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'text'
  | 'note'
  | 'freehand'
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'image'
  | 'textfield'
  | 'checkbox'
  | 'redaction';

/**
 * Available tools
 */
export type AnnotationTool =
  | 'select'
  | 'hand'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'text'
  | 'note'
  | 'freehand'
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'image'
  | 'textfield'
  | 'checkbox'
  | 'redact'
  | null;

/**
 * Base annotation interface
 */
export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  pageNum: number;
  rect: Rect;
  color: Color;
  opacity: number;
  createdAt: Date;
  updatedAt: Date;
  locked: boolean;
}

/**
 * Highlight annotation
 */
export interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight';
}

/**
 * Underline annotation
 */
export interface UnderlineAnnotation extends BaseAnnotation {
  type: 'underline';
}

/**
 * Strikethrough annotation
 */
export interface StrikethroughAnnotation extends BaseAnnotation {
  type: 'strikethrough';
}

/**
 * Text annotation
 */
export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: 'Helvetica' | 'Times' | 'Courier';
  bold: boolean;
  italic: boolean;
}

/**
 * Note (sticky note) annotation
 */
export interface NoteAnnotation extends BaseAnnotation {
  type: 'note';
  title: string;
  content: string;
  isOpen: boolean;
}

/**
 * Freehand drawing annotation
 */
export interface FreehandAnnotation extends BaseAnnotation {
  type: 'freehand';
  paths: Point[][];
  strokeWidth: number;
}

/**
 * Shape annotation (rectangle, circle, ellipse)
 */
export interface ShapeAnnotation extends BaseAnnotation {
  type: 'rectangle' | 'circle' | 'ellipse';
  strokeColor: Color;
  strokeWidth: number;
  filled: boolean;
  fillColor: Color;
}

/**
 * Line annotation
 */
export interface LineAnnotation extends BaseAnnotation {
  type: 'line';
  strokeWidth: number;
  startPoint: Point;
  endPoint: Point;
}

/**
 * Arrow annotation
 */
export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  strokeWidth: number;
  startPoint: Point;
  endPoint: Point;
}

/**
 * Image annotation
 */
export interface ImageAnnotation extends BaseAnnotation {
  type: 'image';
  imageData: string; // Base64
  preserveAspectRatio: boolean;
  rotation: number;
}

/**
 * Text field annotation
 */
export interface TextFieldAnnotation extends BaseAnnotation {
  type: 'textfield';
  name: string;
  defaultValue: string;
  fontSize: number;
  maxLength?: number;
  multiline: boolean;
  required: boolean;
  readonly: boolean;
}

/**
 * Checkbox annotation
 */
export interface CheckboxAnnotation extends BaseAnnotation {
  type: 'checkbox';
  name: string;
  checked: boolean;
  readonly: boolean;
}

/**
 * Redaction annotation
 */
export interface RedactionAnnotation extends BaseAnnotation {
  type: 'redaction';
  searchText?: string;
  applied: boolean;
}

/**
 * Union type for all annotations
 */
export type Annotation =
  | HighlightAnnotation
  | UnderlineAnnotation
  | StrikethroughAnnotation
  | TextAnnotation
  | NoteAnnotation
  | FreehandAnnotation
  | ShapeAnnotation
  | LineAnnotation
  | ArrowAnnotation
  | ImageAnnotation
  | TextFieldAnnotation
  | CheckboxAnnotation
  | RedactionAnnotation;

type NewAnnotation = Annotation extends infer Candidate
  ? Candidate extends Annotation
    ? Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>
    : never
  : never;

/**
 * History entry for undo/redo
 */
export interface HistoryEntry {
  annotations: Annotation[];
  timestamp: Date;
  action: string;
}

/**
 * Tool options
 */
export interface ToolOptions {
  color: Color;
  strokeColor: Color;
  fillColor: Color;
  strokeWidth: number;
  fontSize: number;
  fontFamily: 'Helvetica' | 'Times' | 'Courier';
  opacity: number;
  filled: boolean;
}

/**
 * Default tool options
 */
const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  color: { r: 1, g: 1, b: 0 }, // Yellow for highlights
  strokeColor: { r: 0, g: 0, b: 0 },
  fillColor: { r: 1, g: 1, b: 1 },
  strokeWidth: 2,
  fontSize: 14,
  fontFamily: 'Helvetica',
  opacity: 1,
  filled: false,
};

/**
 * Maximum history entries
 */
const MAX_HISTORY_SIZE = 50;

/**
 * Annotation store state
 */
export interface AnnotationState {
  /** All annotations for the current document */
  annotations: Annotation[];
  /** Currently selected annotation ID */
  selectedAnnotationId: string | null;
  /** Currently active tool */
  currentTool: AnnotationTool;
  /** Tool options */
  toolOptions: ToolOptions;
  /** Whether annotation mode is active */
  isAnnotating: boolean;
  /** Current drawing path (for freehand) */
  currentPath: Point[];
  /** Undo history stack */
  undoStack: HistoryEntry[];
  /** Redo history stack */
  redoStack: HistoryEntry[];
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Current document ID */
  documentId: string | null;
}

/**
 * Annotation store actions
 */
export interface AnnotationActions {
  /** Add a new annotation */
  addAnnotation: (annotation: NewAnnotation) => string;
  /** Update an existing annotation */
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  /** Remove an annotation */
  removeAnnotation: (id: string) => void;
  /** Select an annotation */
  selectAnnotation: (id: string | null) => void;
  /** Get annotation by ID */
  getAnnotationById: (id: string) => Annotation | undefined;
  /** Get annotations for a specific page */
  getAnnotationsForPage: (pageNum: number) => Annotation[];
  /** Set the current tool */
  setCurrentTool: (tool: AnnotationTool) => void;
  /** Update tool options */
  setToolOptions: (options: Partial<ToolOptions>) => void;
  /** Set annotation mode */
  setIsAnnotating: (isAnnotating: boolean) => void;
  /** Start a new drawing path */
  startPath: (point: Point) => void;
  /** Add point to current path */
  addToPath: (point: Point) => void;
  /** End current path and create annotation */
  endPath: (pageNum: number) => string | null;
  /** Clear current path */
  clearPath: () => void;
  /** Undo last action */
  undo: () => void;
  /** Redo last undone action */
  redo: () => void;
  /** Check if can undo */
  canUndo: () => boolean;
  /** Check if can redo */
  canRedo: () => boolean;
  /** Clear all annotations */
  clearAnnotations: () => void;
  /** Load annotations for a document */
  loadAnnotations: (documentId: string, annotations: Annotation[]) => void;
  /** Save current state to history */
  saveToHistory: (action: string) => void;
  /** Lock/unlock an annotation */
  toggleLock: (id: string) => void;
  /** Duplicate an annotation */
  duplicateAnnotation: (id: string) => string | null;
  /** Move annotation to a different page */
  moveAnnotationToPage: (id: string, pageNum: number) => void;
  /** Reset the store */
  reset: () => void;
}

/**
 * Combined store type
 */
export type AnnotationStore = AnnotationState & AnnotationActions;

/**
 * Generate unique annotation ID
 */
function generateAnnotationId(): string {
  return `annot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate bounding rect from points
 */
function calculateBoundingRect(points: Point[]): Rect {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Initial state
 */
const initialState: AnnotationState = {
  annotations: [],
  selectedAnnotationId: null,
  currentTool: 'select',
  toolOptions: { ...DEFAULT_TOOL_OPTIONS },
  isAnnotating: false,
  currentPath: [],
  undoStack: [],
  redoStack: [],
  hasUnsavedChanges: false,
  documentId: null,
};

/**
 * Annotation store
 */
export const useAnnotationStore = create<AnnotationStore>()(
  immer((set, get) => ({
    ...initialState,

    addAnnotation: (annotationData) => {
      const id = generateAnnotationId();
      const now = new Date();

      const annotation: Annotation = {
        ...annotationData,
        id,
        createdAt: now,
        updatedAt: now,
        locked: false,
      } as Annotation;

      set((state) => {
        state.annotations.push(annotation);
        state.hasUnsavedChanges = true;
        state.selectedAnnotationId = id;
      });

      get().saveToHistory(`Add ${annotationData.type}`);
      return id;
    },

    updateAnnotation: (id, updates) => {
      set((state) => {
        const index = state.annotations.findIndex((a) => a.id === id);
        if (index !== -1) {
          const current = state.annotations[index];
          if (current.locked) return;

          state.annotations[index] = {
            ...current,
            ...updates,
            updatedAt: new Date(),
          } as Annotation;
          state.hasUnsavedChanges = true;
        }
      });
      get().saveToHistory('Update annotation');
    },

    removeAnnotation: (id) => {
      const annotation = get().annotations.find((a) => a.id === id);
      if (!annotation || annotation.locked) return;

      set((state) => {
        state.annotations = state.annotations.filter((a) => a.id !== id);
        if (state.selectedAnnotationId === id) {
          state.selectedAnnotationId = null;
        }
        state.hasUnsavedChanges = true;
      });
      get().saveToHistory('Remove annotation');
    },

    selectAnnotation: (id) => {
      set((state) => {
        state.selectedAnnotationId = id;
      });
    },

    getAnnotationById: (id) => {
      return get().annotations.find((a) => a.id === id);
    },

    getAnnotationsForPage: (pageNum) => {
      return get().annotations.filter((a) => a.pageNum === pageNum);
    },

    setCurrentTool: (tool) => {
      set((state) => {
        state.currentTool = tool;
        state.isAnnotating = tool !== 'select' && tool !== 'hand' && tool !== null;

        // Set default colors based on tool
        if (tool === 'highlight') {
          state.toolOptions.color = { r: 1, g: 1, b: 0, a: 0.35 };
        } else if (tool === 'underline' || tool === 'strikethrough') {
          state.toolOptions.color = { r: 0, g: 0, b: 0 };
        } else if (tool === 'redact') {
          state.toolOptions.color = { r: 0, g: 0, b: 0 };
        }
      });
    },

    setToolOptions: (options) => {
      set((state) => {
        state.toolOptions = { ...state.toolOptions, ...options };
      });
    },

    setIsAnnotating: (isAnnotating) => {
      set((state) => {
        state.isAnnotating = isAnnotating;
      });
    },

    startPath: (point) => {
      set((state) => {
        state.currentPath = [point];
      });
    },

    addToPath: (point) => {
      set((state) => {
        state.currentPath.push(point);
      });
    },

    endPath: (pageNum) => {
      const state = get();
      if (state.currentPath.length < 2) {
        set((s) => {
          s.currentPath = [];
        });
        return null;
      }

      const rect = calculateBoundingRect(state.currentPath);
      const paths = [[...state.currentPath]];

      const annotation: Omit<FreehandAnnotation, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'freehand',
        pageNum,
        rect,
        color: state.toolOptions.color,
        opacity: state.toolOptions.opacity,
        paths,
        strokeWidth: state.toolOptions.strokeWidth,
        locked: false,
      };

      const id = get().addAnnotation(annotation);

      set((s) => {
        s.currentPath = [];
      });

      return id;
    },

    clearPath: () => {
      set((state) => {
        state.currentPath = [];
      });
    },

    undo: () => {
      const state = get();
      if (state.undoStack.length === 0) return;

      const lastEntry = state.undoStack[state.undoStack.length - 1];

      set((s) => {
        // Save current state to redo stack
        s.redoStack.push({
          annotations: [...s.annotations],
          timestamp: new Date(),
          action: 'Undo',
        });

        // Restore previous state
        s.annotations = lastEntry.annotations;
        s.undoStack.pop();
        s.hasUnsavedChanges = true;
        s.selectedAnnotationId = null;
      });
    },

    redo: () => {
      const state = get();
      if (state.redoStack.length === 0) return;

      const lastEntry = state.redoStack[state.redoStack.length - 1];

      set((s) => {
        // Save current state to undo stack
        s.undoStack.push({
          annotations: [...s.annotations],
          timestamp: new Date(),
          action: 'Redo',
        });

        // Restore redo state
        s.annotations = lastEntry.annotations;
        s.redoStack.pop();
        s.hasUnsavedChanges = true;
        s.selectedAnnotationId = null;
      });
    },

    canUndo: () => {
      return get().undoStack.length > 0;
    },

    canRedo: () => {
      return get().redoStack.length > 0;
    },

    clearAnnotations: () => {
      get().saveToHistory('Clear all');
      set((state) => {
        state.annotations = [];
        state.selectedAnnotationId = null;
        state.hasUnsavedChanges = true;
      });
    },

    loadAnnotations: (documentId, annotations) => {
      set((state) => {
        state.documentId = documentId;
        state.annotations = annotations;
        state.selectedAnnotationId = null;
        state.undoStack = [];
        state.redoStack = [];
        state.hasUnsavedChanges = false;
      });
    },

    saveToHistory: (action) => {
      set((state) => {
        // Don't save if it's the same as last entry
        const lastEntry = state.undoStack[state.undoStack.length - 1];
        if (lastEntry && JSON.stringify(lastEntry.annotations) === JSON.stringify(state.annotations)) {
          return;
        }

        state.undoStack.push({
          annotations: state.annotations.map((a) => ({ ...a })),
          timestamp: new Date(),
          action,
        });

        // Limit history size
        if (state.undoStack.length > MAX_HISTORY_SIZE) {
          state.undoStack.shift();
        }

        // Clear redo stack on new action
        state.redoStack = [];
      });
    },

    toggleLock: (id) => {
      set((state) => {
        const annotation = state.annotations.find((a) => a.id === id);
        if (annotation) {
          annotation.locked = !annotation.locked;
          annotation.updatedAt = new Date();
        }
      });
    },

    duplicateAnnotation: (id) => {
      const original = get().annotations.find((a) => a.id === id);
      if (!original) return null;

      const duplicated = {
        ...original,
        rect: {
          ...original.rect,
          x: original.rect.x + 20,
          y: original.rect.y - 20,
        },
        locked: false,
      };

      // Remove id, createdAt, updatedAt as they'll be regenerated
      const { id: _, createdAt, updatedAt, ...annotationData } = duplicated;

      return get().addAnnotation(annotationData as NewAnnotation);
    },

    moveAnnotationToPage: (id, pageNum) => {
      set((state) => {
        const annotation = state.annotations.find((a) => a.id === id);
        if (annotation && !annotation.locked) {
          annotation.pageNum = pageNum;
          annotation.updatedAt = new Date();
          state.hasUnsavedChanges = true;
        }
      });
      get().saveToHistory('Move to page');
    },

    reset: () => {
      set(() => ({ ...initialState }));
    },
  }))
);

/**
 * Selector: Get selected annotation
 */
export const selectSelectedAnnotation = (state: AnnotationStore): Annotation | null => {
  if (!state.selectedAnnotationId) return null;
  return state.annotations.find((a) => a.id === state.selectedAnnotationId) ?? null;
};

/**
 * Selector: Get annotation count
 */
export const selectAnnotationCount = (state: AnnotationStore): number => {
  return state.annotations.length;
};

/**
 * Selector: Get annotations by type
 */
export const selectAnnotationsByType = (type: AnnotationType) => (state: AnnotationStore): Annotation[] => {
  return state.annotations.filter((a) => a.type === type);
};

/**
 * Selector: Check if tool is active
 */
export const selectIsToolActive = (tool: AnnotationTool) => (state: AnnotationStore): boolean => {
  return state.currentTool === tool;
};

/**
 * Selector: Get undo count
 */
export const selectUndoCount = (state: AnnotationStore): number => {
  return state.undoStack.length;
};

/**
 * Selector: Get redo count
 */
export const selectRedoCount = (state: AnnotationStore): number => {
  return state.redoStack.length;
};
