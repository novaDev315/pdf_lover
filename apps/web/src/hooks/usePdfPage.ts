/**
 * Custom hook for individual PDF page operations
 * Handles rendering pages at specific scales with lazy loading support
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

/**
 * Page rendering state
 */
export type PageRenderState = 'idle' | 'loading' | 'rendering' | 'rendered' | 'error';

/**
 * Page dimensions
 */
export interface PageDimensions {
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

/**
 * Return type for the usePdfPage hook
 */
export interface UsePdfPageReturn {
  /** Current rendering state */
  renderState: PageRenderState;
  /** Error message if rendering failed */
  error: string | null;
  /** Page dimensions at current scale */
  dimensions: PageDimensions | null;
  /** Whether the page is currently visible */
  isVisible: boolean;
  /** Render the page to a canvas */
  render: (canvas: HTMLCanvasElement) => Promise<void>;
  /** Cancel any pending render operation */
  cancelRender: () => void;
  /** Set visibility state for lazy loading */
  setVisible: (visible: boolean) => void;
  /** Get a thumbnail of the page */
  getThumbnail: (maxWidth: number) => Promise<string>;
}

/**
 * Options for the usePdfPage hook
 */
export interface UsePdfPageOptions {
  /** PDF document proxy from PDF.js */
  pdfDocument: PDFDocumentProxy | null;
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Rendering scale (default: 1.0) */
  scale?: number;
  /** Rotation in degrees (0, 90, 180, 270) */
  rotation?: 0 | 90 | 180 | 270;
  /** Callback when page is rendered */
  onRender?: (dimensions: PageDimensions) => void;
  /** Callback when rendering fails */
  onError?: (error: string) => void;
}

/**
 * Custom hook for managing individual PDF page operations
 *
 * @param options - Configuration options for the hook
 * @returns Object containing page state and control functions
 *
 * @example
 * ```tsx
 * const { render, dimensions, renderState } = usePdfPage({
 *   pdfDocument,
 *   pageNumber: 1,
 *   scale: 1.5,
 *   onRender: (dims) => console.log('Page rendered:', dims),
 * });
 *
 * useEffect(() => {
 *   if (canvasRef.current) {
 *     render(canvasRef.current);
 *   }
 * }, [pdfDocument]);
 * ```
 */
export function usePdfPage(options: UsePdfPageOptions): UsePdfPageReturn {
  const {
    pdfDocument,
    pageNumber,
    scale = 1.0,
    rotation = 0,
    onRender,
    onError,
  } = options;

  const [renderState, setRenderState] = useState<PageRenderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<PageDimensions | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Refs for cleanup
  const pageRef = useRef<PDFPageProxy | null>(null);
  const renderTaskRef = useRef<ReturnType<PDFPageProxy['render']> | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Cancel any pending render operation
   */
  const cancelRender = useCallback(() => {
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
  }, []);

  /**
   * Load the page from the document
   */
  const loadPage = useCallback(async (): Promise<PDFPageProxy | null> => {
    if (!pdfDocument) return null;

    if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
      const errorMsg = `Page ${pageNumber} out of range (1-${pdfDocument.numPages})`;
      setError(errorMsg);
      setRenderState('error');
      onError?.(errorMsg);
      return null;
    }

    try {
      setRenderState('loading');
      const page = await pdfDocument.getPage(pageNumber);
      pageRef.current = page;
      return page;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load page';
      setError(errorMsg);
      setRenderState('error');
      onError?.(errorMsg);
      return null;
    }
  }, [pdfDocument, pageNumber, onError]);

  /**
   * Render the page to a canvas element
   */
  const render = useCallback(
    async (canvas: HTMLCanvasElement): Promise<void> => {
      cancelRender();
      setError(null);

      const page = await loadPage();
      if (!page || !isMountedRef.current) return;

      try {
        setRenderState('rendering');

        // Get viewport with scale and rotation
        const viewport = page.getViewport({ scale, rotation });

        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Could not get canvas 2D context');
        }

        // Handle device pixel ratio for sharp rendering
        const pixelRatio = window.devicePixelRatio || 1;

        // Set canvas dimensions accounting for pixel ratio
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        // Scale context for high DPI displays
        context.scale(pixelRatio, pixelRatio);

        // Store dimensions
        const pageView = page.view;
        const pageDimensions: PageDimensions = {
          width: viewport.width,
          height: viewport.height,
          originalWidth: (pageView?.[2] ?? 0) - (pageView?.[0] ?? 0),
          originalHeight: (pageView?.[3] ?? 0) - (pageView?.[1] ?? 0),
        };

        // Render the page
        const renderTask = page.render({
          canvasContext: context,
          viewport,
        });

        renderTaskRef.current = renderTask;

        await renderTask.promise;

        if (isMountedRef.current) {
          setDimensions(pageDimensions);
          setRenderState('rendered');
          onRender?.(pageDimensions);
        }
      } catch (err) {
        // Ignore cancellation errors
        if (err instanceof Error && err.name === 'RenderingCancelledException') {
          return;
        }

        const errorMsg = err instanceof Error ? err.message : 'Failed to render page';
        if (isMountedRef.current) {
          setError(errorMsg);
          setRenderState('error');
          onError?.(errorMsg);
        }
      }
    },
    [cancelRender, loadPage, scale, rotation, onRender, onError]
  );

  /**
   * Generate a thumbnail of the page
   */
  const getThumbnail = useCallback(
    async (maxWidth: number): Promise<string> => {
      const page = pageRef.current || (await loadPage());
      if (!page) {
        throw new Error('Could not load page for thumbnail');
      }

      // Calculate scale to fit within maxWidth
      const originalViewport = page.getViewport({ scale: 1 });
      const thumbnailScale = maxWidth / originalViewport.width;
      const viewport = page.getViewport({ scale: thumbnailScale, rotation });

      // Create offscreen canvas for thumbnail
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas 2D context');
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render to thumbnail canvas
      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      // Return as data URL
      return canvas.toDataURL('image/png');
    },
    [loadPage, rotation]
  );

  /**
   * Set visibility state for lazy loading optimization
   */
  const setVisible = useCallback((visible: boolean) => {
    setIsVisible(visible);
  }, []);

  // Re-render when scale or rotation changes
  useEffect(() => {
    if (pageRef.current && renderState === 'rendered') {
      // Reset state to trigger re-render if needed
      setDimensions(null);
    }
  }, [scale, rotation, renderState]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cancelRender();
    };
  }, [cancelRender]);

  // Reset when document changes
  useEffect(() => {
    pageRef.current = null;
    setRenderState('idle');
    setError(null);
    setDimensions(null);
  }, [pdfDocument, pageNumber]);

  return {
    renderState,
    error,
    dimensions,
    isVisible,
    render,
    cancelRender,
    setVisible,
    getThumbnail,
  };
}

export default usePdfPage;
