/**
 * Tests for PDF store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import {
  usePDFStore,
  selectDocumentById,
  selectPagesForDocument,
  selectTotalPageCount,
  selectAllSelectedPages,
} from '../../store/pdf-store';
import type { PDFDocument, PDFPage } from '@pdflover/shared';

// Helper to create mock PDF document
const createMockDocument = (
  id: string,
  pageCount: number = 3
): PDFDocument => ({
  id,
  filename: `document-${id}.pdf`,
  size: 1024 * pageCount,
  pageCount,
  pages: Array.from({ length: pageCount }, (_, i) => ({
    pageNumber: i + 1,
    width: 612,
    height: 792,
    rotation: 0 as 0 | 90 | 180 | 270,
  })),
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('usePDFStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    act(() => {
      usePDFStore.getState().clearDocuments();
      usePDFStore.getState().setError(null);
      usePDFStore.getState().setLoading(false);
    });
  });

  describe('document management', () => {
    describe('addDocument', () => {
      it('should add a document to the store', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
        });

        const state = usePDFStore.getState();
        expect(state.documents).toHaveLength(1);
        expect(state.documents[0].id).toBe('doc-1');
      });

      it('should not add duplicate documents', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().addDocument(doc);
        });

        const state = usePDFStore.getState();
        expect(state.documents).toHaveLength(1);
      });

      it('should add multiple different documents', () => {
        const doc1 = createMockDocument('doc-1');
        const doc2 = createMockDocument('doc-2');

        act(() => {
          usePDFStore.getState().addDocument(doc1);
          usePDFStore.getState().addDocument(doc2);
        });

        const state = usePDFStore.getState();
        expect(state.documents).toHaveLength(2);
      });
    });

    describe('removeDocument', () => {
      it('should remove a document by ID', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().removeDocument('doc-1');
        });

        const state = usePDFStore.getState();
        expect(state.documents).toHaveLength(0);
      });

      it('should clear current document if it was removed', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().setCurrentDocument(doc);
          usePDFStore.getState().removeDocument('doc-1');
        });

        const state = usePDFStore.getState();
        expect(state.currentDocument).toBeNull();
      });

      it('should clear page selections for removed document', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().selectPages('doc-1', [1, 2]);
          usePDFStore.getState().removeDocument('doc-1');
        });

        const state = usePDFStore.getState();
        expect(state.selectedPages).toHaveLength(0);
      });

      it('should handle removing non-existent document', () => {
        act(() => {
          usePDFStore.getState().removeDocument('non-existent');
        });

        const state = usePDFStore.getState();
        expect(state.documents).toHaveLength(0);
      });
    });

    describe('setCurrentDocument', () => {
      it('should set current document', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().setCurrentDocument(doc);
        });

        const state = usePDFStore.getState();
        expect(state.currentDocument?.id).toBe('doc-1');
      });

      it('should allow setting current document to null', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().setCurrentDocument(doc);
          usePDFStore.getState().setCurrentDocument(null);
        });

        const state = usePDFStore.getState();
        expect(state.currentDocument).toBeNull();
      });
    });

    describe('updateDocument', () => {
      it('should update document properties', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().updateDocument('doc-1', {
            filename: 'updated.pdf',
          });
        });

        const state = usePDFStore.getState();
        expect(state.documents[0].filename).toBe('updated.pdf');
      });

      it('should update updatedAt timestamp', () => {
        const doc = createMockDocument('doc-1');
        const originalDate = new Date(0);
        doc.updatedAt = originalDate;

        act(() => {
          usePDFStore.getState().addDocument(doc);
        });

        act(() => {
          usePDFStore.getState().updateDocument('doc-1', {
            filename: 'updated.pdf',
          });
        });

        const state = usePDFStore.getState();
        expect(state.documents[0].updatedAt).not.toEqual(originalDate);
      });

      it('should update current document if it matches', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().setCurrentDocument(doc);
          usePDFStore.getState().updateDocument('doc-1', {
            filename: 'updated.pdf',
          });
        });

        const state = usePDFStore.getState();
        expect(state.currentDocument?.filename).toBe('updated.pdf');
      });

      it('should handle updating non-existent document', () => {
        act(() => {
          usePDFStore.getState().updateDocument('non-existent', {
            filename: 'updated.pdf',
          });
        });

        // Should not throw and documents should be empty
        const state = usePDFStore.getState();
        expect(state.documents).toHaveLength(0);
      });
    });
  });

  describe('page selection', () => {
    describe('selectPages', () => {
      it('should select pages for a document', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().selectPages('doc-1', [1, 2, 3]);
        });

        const state = usePDFStore.getState();
        expect(state.selectedPages).toHaveLength(1);
        expect(state.selectedPages[0].documentId).toBe('doc-1');
        expect(state.selectedPages[0].pageNumbers).toEqual([1, 2, 3]);
      });

      it('should update selection for existing document', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().selectPages('doc-1', [1, 2]);
          usePDFStore.getState().selectPages('doc-1', [2, 3]);
        });

        const state = usePDFStore.getState();
        expect(state.selectedPages).toHaveLength(1);
        expect(state.selectedPages[0].pageNumbers).toEqual([2, 3]);
      });

      it('should handle selections for multiple documents', () => {
        const doc1 = createMockDocument('doc-1');
        const doc2 = createMockDocument('doc-2');

        act(() => {
          usePDFStore.getState().addDocument(doc1);
          usePDFStore.getState().addDocument(doc2);
          usePDFStore.getState().selectPages('doc-1', [1]);
          usePDFStore.getState().selectPages('doc-2', [2, 3]);
        });

        const state = usePDFStore.getState();
        expect(state.selectedPages).toHaveLength(2);
      });
    });

    describe('clearPageSelection', () => {
      it('should clear selection for specific document', () => {
        const doc1 = createMockDocument('doc-1');
        const doc2 = createMockDocument('doc-2');

        act(() => {
          usePDFStore.getState().addDocument(doc1);
          usePDFStore.getState().addDocument(doc2);
          usePDFStore.getState().selectPages('doc-1', [1]);
          usePDFStore.getState().selectPages('doc-2', [2]);
          usePDFStore.getState().clearPageSelection('doc-1');
        });

        const state = usePDFStore.getState();
        expect(state.selectedPages).toHaveLength(1);
        expect(state.selectedPages[0].documentId).toBe('doc-2');
      });
    });

    describe('clearAllPageSelections', () => {
      it('should clear all page selections', () => {
        const doc1 = createMockDocument('doc-1');
        const doc2 = createMockDocument('doc-2');

        act(() => {
          usePDFStore.getState().addDocument(doc1);
          usePDFStore.getState().addDocument(doc2);
          usePDFStore.getState().selectPages('doc-1', [1]);
          usePDFStore.getState().selectPages('doc-2', [2]);
          usePDFStore.getState().clearAllPageSelections();
        });

        const state = usePDFStore.getState();
        expect(state.selectedPages).toHaveLength(0);
      });
    });
  });

  describe('page operations', () => {
    describe('rotatePage', () => {
      it('should rotate a page by 90 degrees', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().rotatePage('doc-1', 1, 90);
        });

        const state = usePDFStore.getState();
        expect(state.documents[0].pages[0].rotation).toBe(90);
      });

      it('should rotate a page by 180 degrees', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().rotatePage('doc-1', 1, 180);
        });

        const state = usePDFStore.getState();
        expect(state.documents[0].pages[0].rotation).toBe(180);
      });

      it('should accumulate rotations', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().rotatePage('doc-1', 1, 90);
          usePDFStore.getState().rotatePage('doc-1', 1, 90);
        });

        const state = usePDFStore.getState();
        expect(state.documents[0].pages[0].rotation).toBe(180);
      });

      it('should wrap rotation at 360 degrees', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().rotatePage('doc-1', 1, 270);
          usePDFStore.getState().rotatePage('doc-1', 1, 180);
        });

        const state = usePDFStore.getState();
        expect(state.documents[0].pages[0].rotation).toBe(90);
      });

      it('should update current document if it matches', () => {
        const doc = createMockDocument('doc-1');

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().setCurrentDocument(doc);
          usePDFStore.getState().rotatePage('doc-1', 1, 90);
        });

        const state = usePDFStore.getState();
        expect(state.currentDocument?.pages[0].rotation).toBe(90);
      });
    });

    describe('reorderPages', () => {
      it('should reorder pages', () => {
        const doc = createMockDocument('doc-1', 3);

        act(() => {
          usePDFStore.getState().addDocument(doc);
          usePDFStore.getState().reorderPages('doc-1', [3, 1, 2]);
        });

        const state = usePDFStore.getState();
        // After reorder, page numbers should be reassigned 1, 2, 3
        expect(state.documents[0].pages[0].pageNumber).toBe(1);
        expect(state.documents[0].pages[1].pageNumber).toBe(2);
        expect(state.documents[0].pages[2].pageNumber).toBe(3);
      });
    });
  });

  describe('loading and error state', () => {
    describe('setLoading', () => {
      it('should set loading state', () => {
        act(() => {
          usePDFStore.getState().setLoading(true);
        });

        expect(usePDFStore.getState().isLoading).toBe(true);
      });

      it('should reset progress when loading is set to false', () => {
        act(() => {
          usePDFStore.getState().setProgress(50, 'Processing');
          usePDFStore.getState().setLoading(false);
        });

        const state = usePDFStore.getState();
        expect(state.isLoading).toBe(false);
        expect(state.progress).toBe(0);
        expect(state.progressStage).toBeNull();
      });
    });

    describe('setError', () => {
      it('should set error state', () => {
        act(() => {
          usePDFStore.getState().setError('Test error');
        });

        expect(usePDFStore.getState().error).toBe('Test error');
      });

      it('should set loading to false when error is set', () => {
        act(() => {
          usePDFStore.getState().setLoading(true);
          usePDFStore.getState().setError('Test error');
        });

        expect(usePDFStore.getState().isLoading).toBe(false);
      });

      it('should allow clearing error', () => {
        act(() => {
          usePDFStore.getState().setError('Test error');
          usePDFStore.getState().setError(null);
        });

        expect(usePDFStore.getState().error).toBeNull();
      });
    });

    describe('setProgress', () => {
      it('should set progress value', () => {
        act(() => {
          usePDFStore.getState().setProgress(50);
        });

        expect(usePDFStore.getState().progress).toBe(50);
      });

      it('should set progress stage', () => {
        act(() => {
          usePDFStore.getState().setProgress(50, 'Processing');
        });

        const state = usePDFStore.getState();
        expect(state.progress).toBe(50);
        expect(state.progressStage).toBe('Processing');
      });

      it('should clamp progress to 0-100 range', () => {
        act(() => {
          usePDFStore.getState().setProgress(-10);
        });
        expect(usePDFStore.getState().progress).toBe(0);

        act(() => {
          usePDFStore.getState().setProgress(150);
        });
        expect(usePDFStore.getState().progress).toBe(100);
      });
    });

    describe('resetProgress', () => {
      it('should reset progress to 0', () => {
        act(() => {
          usePDFStore.getState().setProgress(75, 'Almost done');
          usePDFStore.getState().resetProgress();
        });

        const state = usePDFStore.getState();
        expect(state.progress).toBe(0);
        expect(state.progressStage).toBeNull();
      });
    });
  });

  describe('clearDocuments', () => {
    it('should clear all documents', () => {
      const doc1 = createMockDocument('doc-1');
      const doc2 = createMockDocument('doc-2');

      act(() => {
        usePDFStore.getState().addDocument(doc1);
        usePDFStore.getState().addDocument(doc2);
        usePDFStore.getState().clearDocuments();
      });

      const state = usePDFStore.getState();
      expect(state.documents).toHaveLength(0);
    });

    it('should clear current document', () => {
      const doc = createMockDocument('doc-1');

      act(() => {
        usePDFStore.getState().addDocument(doc);
        usePDFStore.getState().setCurrentDocument(doc);
        usePDFStore.getState().clearDocuments();
      });

      expect(usePDFStore.getState().currentDocument).toBeNull();
    });

    it('should clear page selections', () => {
      const doc = createMockDocument('doc-1');

      act(() => {
        usePDFStore.getState().addDocument(doc);
        usePDFStore.getState().selectPages('doc-1', [1, 2]);
        usePDFStore.getState().clearDocuments();
      });

      expect(usePDFStore.getState().selectedPages).toHaveLength(0);
    });

    it('should clear error', () => {
      act(() => {
        usePDFStore.getState().setError('Test error');
        usePDFStore.getState().clearDocuments();
      });

      expect(usePDFStore.getState().error).toBeNull();
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    act(() => {
      usePDFStore.getState().clearDocuments();
    });
  });

  describe('selectDocumentById', () => {
    it('should find document by ID', () => {
      const doc = createMockDocument('doc-1');

      act(() => {
        usePDFStore.getState().addDocument(doc);
      });

      const state = usePDFStore.getState();
      const result = selectDocumentById('doc-1')(state);
      expect(result?.id).toBe('doc-1');
    });

    it('should return undefined for non-existent ID', () => {
      const state = usePDFStore.getState();
      const result = selectDocumentById('non-existent')(state);
      expect(result).toBeUndefined();
    });
  });

  describe('selectPagesForDocument', () => {
    it('should return selected pages for document', () => {
      const doc = createMockDocument('doc-1');

      act(() => {
        usePDFStore.getState().addDocument(doc);
        usePDFStore.getState().selectPages('doc-1', [1, 2, 3]);
      });

      const state = usePDFStore.getState();
      const result = selectPagesForDocument('doc-1')(state);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return empty array for document with no selection', () => {
      const state = usePDFStore.getState();
      const result = selectPagesForDocument('non-existent')(state);
      expect(result).toEqual([]);
    });
  });

  describe('selectTotalPageCount', () => {
    it('should calculate total pages across all documents', () => {
      const doc1 = createMockDocument('doc-1', 3);
      const doc2 = createMockDocument('doc-2', 5);

      act(() => {
        usePDFStore.getState().addDocument(doc1);
        usePDFStore.getState().addDocument(doc2);
      });

      const state = usePDFStore.getState();
      const result = selectTotalPageCount(state);
      expect(result).toBe(8);
    });

    it('should return 0 for no documents', () => {
      const state = usePDFStore.getState();
      const result = selectTotalPageCount(state);
      expect(result).toBe(0);
    });
  });

  describe('selectAllSelectedPages', () => {
    it('should return all page selections', () => {
      const doc1 = createMockDocument('doc-1');
      const doc2 = createMockDocument('doc-2');

      act(() => {
        usePDFStore.getState().addDocument(doc1);
        usePDFStore.getState().addDocument(doc2);
        usePDFStore.getState().selectPages('doc-1', [1]);
        usePDFStore.getState().selectPages('doc-2', [2, 3]);
      });

      const state = usePDFStore.getState();
      const result = selectAllSelectedPages(state);
      expect(result).toHaveLength(2);
    });
  });
});
