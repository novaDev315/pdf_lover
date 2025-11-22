/**
 * PDF Document State Management
 * Manages PDF documents, pages, and related operations
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { PDFDocument, PDFPage } from '@pdflover/shared';

/**
 * Selected pages for batch operations
 */
export interface PageSelection {
  documentId: string;
  pageNumbers: number[];
}

/**
 * PDF store state interface
 */
export interface PDFState {
  /** All loaded PDF documents */
  documents: PDFDocument[];
  /** Currently active document */
  currentDocument: PDFDocument | null;
  /** Currently selected pages across documents */
  selectedPages: PageSelection[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Processing progress (0-100) */
  progress: number;
  /** Current processing stage description */
  progressStage: string | null;
}

/**
 * PDF store actions interface
 */
export interface PDFActions {
  /** Add a new document to the store */
  addDocument: (document: PDFDocument) => void;
  /** Remove a document by ID */
  removeDocument: (documentId: string) => void;
  /** Set the current active document */
  setCurrentDocument: (document: PDFDocument | null) => void;
  /** Update an existing document */
  updateDocument: (documentId: string, updates: Partial<PDFDocument>) => void;
  /** Select pages in a document */
  selectPages: (documentId: string, pageNumbers: number[]) => void;
  /** Clear page selection for a document */
  clearPageSelection: (documentId: string) => void;
  /** Clear all page selections */
  clearAllPageSelections: () => void;
  /** Rotate a page in a document */
  rotatePage: (documentId: string, pageNumber: number, angle: 90 | 180 | 270) => void;
  /** Reorder pages in a document */
  reorderPages: (documentId: string, newOrder: number[]) => void;
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Update progress */
  setProgress: (progress: number, stage?: string) => void;
  /** Reset progress */
  resetProgress: () => void;
  /** Clear all documents */
  clearDocuments: () => void;
}

/**
 * Combined PDF store type
 */
export type PDFStore = PDFState & PDFActions;

/**
 * Initial state for the PDF store
 */
const initialState: PDFState = {
  documents: [],
  currentDocument: null,
  selectedPages: [],
  isLoading: false,
  error: null,
  progress: 0,
  progressStage: null,
};

/**
 * PDF document store
 * Manages PDF documents, page selections, and processing state
 */
export const usePDFStore = create<PDFStore>()(
  immer((set, get) => ({
    ...initialState,

    addDocument: (document: PDFDocument) => {
      set((state) => {
        // Avoid duplicates
        const exists = state.documents.some((doc) => doc.id === document.id);
        if (!exists) {
          state.documents.push(document);
        }
      });
    },

    removeDocument: (documentId: string) => {
      set((state) => {
        state.documents = state.documents.filter((doc) => doc.id !== documentId);
        // Clear current document if it was removed
        if (state.currentDocument?.id === documentId) {
          state.currentDocument = null;
        }
        // Clear page selections for removed document
        state.selectedPages = state.selectedPages.filter(
          (selection) => selection.documentId !== documentId
        );
      });
    },

    setCurrentDocument: (document: PDFDocument | null) => {
      set((state) => {
        state.currentDocument = document;
      });
    },

    updateDocument: (documentId: string, updates: Partial<PDFDocument>) => {
      set((state) => {
        const index = state.documents.findIndex((doc) => doc.id === documentId);
        if (index !== -1) {
          state.documents[index] = {
            ...state.documents[index],
            ...updates,
            updatedAt: new Date(),
          };
          // Update current document if it matches
          if (state.currentDocument?.id === documentId) {
            state.currentDocument = state.documents[index];
          }
        }
      });
    },

    selectPages: (documentId: string, pageNumbers: number[]) => {
      set((state) => {
        const existingIndex = state.selectedPages.findIndex(
          (selection) => selection.documentId === documentId
        );
        if (existingIndex !== -1) {
          state.selectedPages[existingIndex].pageNumbers = pageNumbers;
        } else {
          state.selectedPages.push({ documentId, pageNumbers });
        }
      });
    },

    clearPageSelection: (documentId: string) => {
      set((state) => {
        state.selectedPages = state.selectedPages.filter(
          (selection) => selection.documentId !== documentId
        );
      });
    },

    clearAllPageSelections: () => {
      set((state) => {
        state.selectedPages = [];
      });
    },

    rotatePage: (documentId: string, pageNumber: number, angle: 90 | 180 | 270) => {
      set((state) => {
        const docIndex = state.documents.findIndex((doc) => doc.id === documentId);
        if (docIndex !== -1) {
          const doc = state.documents[docIndex];
          const pageIndex = doc.pages.findIndex((p) => p.pageNumber === pageNumber);
          if (pageIndex !== -1) {
            const currentRotation = doc.pages[pageIndex].rotation;
            const newRotation = ((currentRotation + angle) % 360) as 0 | 90 | 180 | 270;
            state.documents[docIndex].pages[pageIndex].rotation = newRotation;
            state.documents[docIndex].updatedAt = new Date();
            // Update current document if it matches
            if (state.currentDocument?.id === documentId) {
              state.currentDocument = state.documents[docIndex];
            }
          }
        }
      });
    },

    reorderPages: (documentId: string, newOrder: number[]) => {
      set((state) => {
        const docIndex = state.documents.findIndex((doc) => doc.id === documentId);
        if (docIndex !== -1) {
          const doc = state.documents[docIndex];
          // Create a map of page number to page object
          const pageMap = new Map(doc.pages.map((page) => [page.pageNumber, page]));
          // Reorder pages based on new order
          const reorderedPages: PDFPage[] = newOrder
            .map((pageNum, index) => {
              const page = pageMap.get(pageNum);
              if (page) {
                return { ...page, pageNumber: index + 1 };
              }
              return null;
            })
            .filter((page): page is PDFPage => page !== null);

          state.documents[docIndex].pages = reorderedPages;
          state.documents[docIndex].updatedAt = new Date();
          // Update current document if it matches
          if (state.currentDocument?.id === documentId) {
            state.currentDocument = state.documents[docIndex];
          }
        }
      });
    },

    setLoading: (isLoading: boolean) => {
      set((state) => {
        state.isLoading = isLoading;
        if (!isLoading) {
          state.progress = 0;
          state.progressStage = null;
        }
      });
    },

    setError: (error: string | null) => {
      set((state) => {
        state.error = error;
        if (error) {
          state.isLoading = false;
        }
      });
    },

    setProgress: (progress: number, stage?: string) => {
      set((state) => {
        state.progress = Math.min(100, Math.max(0, progress));
        if (stage !== undefined) {
          state.progressStage = stage;
        }
      });
    },

    resetProgress: () => {
      set((state) => {
        state.progress = 0;
        state.progressStage = null;
      });
    },

    clearDocuments: () => {
      set((state) => {
        state.documents = [];
        state.currentDocument = null;
        state.selectedPages = [];
        state.error = null;
      });
    },
  }))
);

/**
 * Selector: Get document by ID
 */
export const selectDocumentById = (documentId: string) => (state: PDFStore) =>
  state.documents.find((doc) => doc.id === documentId);

/**
 * Selector: Get selected pages for a document
 */
export const selectPagesForDocument = (documentId: string) => (state: PDFStore) =>
  state.selectedPages.find((selection) => selection.documentId === documentId)?.pageNumbers ?? [];

/**
 * Selector: Get total page count across all documents
 */
export const selectTotalPageCount = (state: PDFStore) =>
  state.documents.reduce((total, doc) => total + doc.pageCount, 0);

/**
 * Selector: Get all selected pages across all documents
 */
export const selectAllSelectedPages = (state: PDFStore) => state.selectedPages;
