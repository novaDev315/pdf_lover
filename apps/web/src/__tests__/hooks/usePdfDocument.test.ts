/**
 * Tests for usePdfDocument hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock pdfjs-dist before importing the hook
vi.mock('pdfjs-dist', () => {
  const mockPage = {
    getViewport: vi.fn(({ scale = 1 }) => ({
      width: 612 * scale,
      height: 792 * scale,
    })),
    render: vi.fn(() => ({
      promise: Promise.resolve(),
    })),
  };

  const mockDocument = {
    numPages: 5,
    getPage: vi.fn().mockResolvedValue(mockPage),
    getMetadata: vi.fn().mockResolvedValue({
      info: {
        Title: 'Test Document',
        Author: 'Test Author',
        Subject: 'Test Subject',
        Keywords: 'test, pdf, document',
        Creator: 'Test Creator',
        Producer: 'Test Producer',
        CreationDate: 'D:20240115120000',
        ModDate: 'D:20240116120000',
      },
      metadata: {
        get: vi.fn((key) => {
          if (key === 'pdf:PDFVersion') return '1.7';
          return null;
        }),
      },
    }),
    destroy: vi.fn(),
  };

  const mockLoadingTask = {
    promise: Promise.resolve(mockDocument),
    onProgress: null as ((data: { loaded: number; total: number }) => void) | null,
    destroy: vi.fn(),
  };

  return {
    GlobalWorkerOptions: {
      workerSrc: '',
    },
    getDocument: vi.fn(() => {
      // Simulate progress callbacks
      setTimeout(() => {
        if (mockLoadingTask.onProgress) {
          mockLoadingTask.onProgress({ loaded: 50, total: 100 });
          mockLoadingTask.onProgress({ loaded: 100, total: 100 });
        }
      }, 10);
      return mockLoadingTask;
    }),
    __mockDocument: mockDocument,
    __mockLoadingTask: mockLoadingTask,
    __resetMocks: () => {
      mockLoadingTask.promise = Promise.resolve(mockDocument);
    },
    __setLoadError: (error: Error) => {
      mockLoadingTask.promise = Promise.reject(error);
    },
  };
});

// Import hook after mocking
import { usePdfDocument } from '../../hooks/usePdfDocument';
import * as pdfjs from 'pdfjs-dist';

// Create mock PDF buffer
const createMockPdfBuffer = (): ArrayBuffer => {
  const buffer = new ArrayBuffer(100);
  const view = new Uint8Array(buffer);
  view[0] = 0x25; // %
  view[1] = 0x50; // P
  view[2] = 0x44; // D
  view[3] = 0x46; // F
  view[4] = 0x2d; // -
  return buffer;
};

// Create mock file
const createMockPdfFile = (): File => {
  const buffer = createMockPdfBuffer();
  return new File([buffer], 'test.pdf', { type: 'application/pdf' });
};

describe('usePdfDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (pdfjs as any).__resetMocks?.();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have idle loading state initially', () => {
      const { result } = renderHook(() => usePdfDocument());

      expect(result.current.loadingState).toBe('idle');
      expect(result.current.pdfDocument).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toBe(0);
      expect(result.current.metadata).toBeNull();
    });
  });

  describe('loadFromArrayBuffer', () => {
    it('should load PDF from ArrayBuffer', async () => {
      const { result } = renderHook(() => usePdfDocument());
      const buffer = createMockPdfBuffer();

      await act(async () => {
        await result.current.loadFromArrayBuffer(buffer);
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });

      expect(result.current.pdfDocument).toBeDefined();
      expect(result.current.metadata).toBeDefined();
      expect(result.current.metadata?.pageCount).toBe(5);
    });

    it('should extract metadata correctly', async () => {
      const { result } = renderHook(() => usePdfDocument());
      const buffer = createMockPdfBuffer();

      await act(async () => {
        await result.current.loadFromArrayBuffer(buffer);
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });

      expect(result.current.metadata?.title).toBe('Test Document');
      expect(result.current.metadata?.author).toBe('Test Author');
    });
  });

  describe('loadFromFile', () => {
    it('should load PDF from File object', async () => {
      const { result } = renderHook(() => usePdfDocument());
      const file = createMockPdfFile();

      await act(async () => {
        await result.current.loadFromFile(file);
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });

      expect(result.current.pdfDocument).toBeDefined();
    });

    it('should reject non-PDF files', async () => {
      const { result } = renderHook(() => usePdfDocument());
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      await act(async () => {
        await result.current.loadFromFile(file);
      });

      expect(result.current.loadingState).toBe('error');
      expect(result.current.error).toContain('Invalid file type');
    });

    it('should accept files with .pdf extension', async () => {
      const { result } = renderHook(() => usePdfDocument());
      const buffer = createMockPdfBuffer();
      const file = new File([buffer], 'document.pdf', {
        type: 'application/octet-stream',
      });

      await act(async () => {
        await result.current.loadFromFile(file);
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });
    });
  });

  describe('loadFromUrl', () => {
    it('should load PDF from URL', async () => {
      const { result } = renderHook(() => usePdfDocument());

      await act(async () => {
        await result.current.loadFromUrl('https://example.com/test.pdf');
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });

      expect(pdfjs.getDocument).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com/test.pdf' })
      );
    });
  });

  describe('closeDocument', () => {
    it('should close and cleanup document', async () => {
      const { result } = renderHook(() => usePdfDocument());
      const buffer = createMockPdfBuffer();

      await act(async () => {
        await result.current.loadFromArrayBuffer(buffer);
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });

      act(() => {
        result.current.closeDocument();
      });

      expect(result.current.pdfDocument).toBeNull();
      expect(result.current.metadata).toBeNull();
      expect(result.current.loadingState).toBe('idle');
      expect(result.current.progress).toBe(0);
    });
  });

  describe('callbacks', () => {
    it('should call onLoad callback when document is loaded', async () => {
      const onLoad = vi.fn();
      const { result } = renderHook(() => usePdfDocument({ onLoad }));
      const buffer = createMockPdfBuffer();

      await act(async () => {
        await result.current.loadFromArrayBuffer(buffer);
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });

      expect(onLoad).toHaveBeenCalledWith(
        expect.objectContaining({ pageCount: 5 })
      );
    });

    it('should call onError callback when loading fails', async () => {
      (pdfjs as any).__setLoadError?.(new Error('Load failed'));

      const onError = vi.fn();
      const { result } = renderHook(() => usePdfDocument({ onError }));
      const buffer = createMockPdfBuffer();

      await act(async () => {
        await result.current.loadFromArrayBuffer(buffer);
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('error');
      });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Load failed'));
    });

    it('should call onProgress callback during loading', async () => {
      const onProgress = vi.fn();
      const { result } = renderHook(() => usePdfDocument({ onProgress }));
      const buffer = createMockPdfBuffer();

      await act(async () => {
        await result.current.loadFromArrayBuffer(buffer);
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });

      // Progress should have been called with values
      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('renderPage', () => {
    it('should render a page to canvas', async () => {
      const { result } = renderHook(() => usePdfDocument());
      const buffer = createMockPdfBuffer();

      await act(async () => {
        await result.current.loadFromArrayBuffer(buffer);
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });

      const canvas = document.createElement('canvas');
      const mockContext = {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
      };
      vi.spyOn(canvas, 'getContext').mockReturnValue(mockContext as any);

      const dimensions = await result.current.renderPage(1, canvas, 1.0);

      expect(dimensions.width).toBe(612);
      expect(dimensions.height).toBe(792);
    });

    it('should throw error if no document is loaded', async () => {
      const { result } = renderHook(() => usePdfDocument());
      const canvas = document.createElement('canvas');

      await expect(result.current.renderPage(1, canvas)).rejects.toThrow(
        'No PDF document loaded'
      );
    });

    it('should throw error for out of range page', async () => {
      const { result } = renderHook(() => usePdfDocument());
      const buffer = createMockPdfBuffer();

      await act(async () => {
        await result.current.loadFromArrayBuffer(buffer);
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });

      const canvas = document.createElement('canvas');
      const mockContext = { fillRect: vi.fn() };
      vi.spyOn(canvas, 'getContext').mockReturnValue(mockContext as any);

      await expect(result.current.renderPage(10, canvas)).rejects.toThrow(
        'out of range'
      );
    });
  });

  describe('getPageDimensions', () => {
    it('should return page dimensions', async () => {
      const { result } = renderHook(() => usePdfDocument());
      const buffer = createMockPdfBuffer();

      await act(async () => {
        await result.current.loadFromArrayBuffer(buffer);
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });

      const dimensions = await result.current.getPageDimensions(1);

      expect(dimensions.width).toBe(612);
      expect(dimensions.height).toBe(792);
    });

    it('should apply scale to dimensions', async () => {
      const { result } = renderHook(() => usePdfDocument());
      const buffer = createMockPdfBuffer();

      await act(async () => {
        await result.current.loadFromArrayBuffer(buffer);
      });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });

      const dimensions = await result.current.getPageDimensions(1, 2.0);

      expect(dimensions.width).toBe(612 * 2);
      expect(dimensions.height).toBe(792 * 2);
    });

    it('should throw error if no document is loaded', async () => {
      const { result } = renderHook(() => usePdfDocument());

      await expect(result.current.getPageDimensions(1)).rejects.toThrow(
        'No PDF document loaded'
      );
    });
  });

  describe('loading state transitions', () => {
    it('should transition through loading states correctly', async () => {
      const states: string[] = [];
      const { result } = renderHook(() => usePdfDocument());

      states.push(result.current.loadingState);

      const buffer = createMockPdfBuffer();

      act(() => {
        result.current.loadFromArrayBuffer(buffer);
      });

      states.push(result.current.loadingState);

      await waitFor(() => {
        expect(result.current.loadingState).toBe('loaded');
      });

      states.push(result.current.loadingState);

      // Should have gone through idle -> loading -> loaded
      expect(states).toContain('idle');
      expect(states).toContain('loading');
      expect(states[states.length - 1]).toBe('loaded');
    });
  });
});
