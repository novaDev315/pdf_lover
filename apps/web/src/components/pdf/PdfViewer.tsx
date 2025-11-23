/**
 * PdfViewer Component
 * Main PDF viewer component with rendering, navigation, and editing features
 */

import * as React from 'react';
import { usePdfDocument, type PdfMetadata } from '@/hooks/usePdfDocument';
import { useTextSearch, type SearchResult } from '@/hooks/useTextSearch';
import { EditToolbar, type ToolType } from './EditToolbar';
import { PageThumbnails } from './PageThumbnails';
import { SearchPanel } from './SearchPanel';
import { type ZoomMode } from './ZoomControls';
import { cn } from '@/lib/utils';
import { downloadBlob, arrayBufferToBlob } from '@/lib/utils';

/**
 * Keyboard shortcut bindings
 */
const KEYBOARD_SHORTCUTS = {
  nextPage: ['ArrowRight', 'PageDown', 'j'] as string[],
  prevPage: ['ArrowLeft', 'PageUp', 'k'] as string[],
  zoomIn: ['+', '='] as string[],
  zoomOut: ['-', '_'] as string[],
  fullscreen: ['f', 'F'] as string[],
  escape: ['Escape'] as string[],
  download: ['s'] as string[],
  selectTool: ['v', 'V'] as string[],
  handTool: ['h', 'H'] as string[],
  textTool: ['t', 'T'] as string[],
  highlightTool: ['l', 'L'] as string[],
  search: ['f'] as string[],
};

/**
 * Props for the PdfViewer component
 */
export interface PdfViewerProps {
  /** Initial PDF file to load */
  file?: File;
  /** Initial PDF URL to load */
  url?: string;
  /** Initial PDF ArrayBuffer to load */
  arrayBuffer?: ArrayBuffer;
  /** Initial page number (1-indexed) */
  initialPage?: number;
  /** Initial zoom level (1.0 = 100%) */
  initialZoom?: number;
  /** Whether to show the toolbar */
  showToolbar?: boolean;
  /** Whether to show the thumbnail sidebar */
  showThumbnails?: boolean;
  /** Whether to enable page reordering */
  enableReorder?: boolean;
  /** Whether to enable search functionality */
  enableSearch?: boolean;
  /** Callback when document is loaded */
  onLoad?: (metadata: PdfMetadata) => void;
  /** Callback when loading fails */
  onError?: (error: string) => void;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
  /** Callback when pages are reordered */
  onReorder?: (newOrder: number[]) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Page component for rendering individual PDF pages
 */
interface PageCanvasProps {
  pdfDocument: ReturnType<typeof usePdfDocument>['pdfDocument'];
  pageNumber: number;
  scale: number;
  rotation: 0 | 90 | 180 | 270;
  isVisible: boolean;
  onRender?: (dimensions: { width: number; height: number }) => void;
  searchResults?: SearchResult[];
  currentMatchIndex?: number;
}

function PageCanvas({
  pdfDocument,
  pageNumber,
  scale,
  rotation,
  isVisible,
  onRender,
  searchResults = [],
  currentMatchIndex = -1,
}: PageCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const highlightCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = React.useState(false);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const [pageHeight, setPageHeight] = React.useState(0);
  const renderTaskRef = React.useRef<{ cancel: () => void } | null>(null);

  // Render page when visible or when scale/rotation changes
  React.useEffect(() => {
    if (!pdfDocument || !canvasRef.current || !isVisible) return;

    const renderPage = async () => {
      if (!canvasRef.current) return;

      // Cancel any pending render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      setIsRendering(true);

      try {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale, rotation });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Handle device pixel ratio
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.scale(pixelRatio, pixelRatio);

        const renderTask = page.render({
          canvasContext: context,
          viewport,
        });

        renderTaskRef.current = renderTask;

        await renderTask.promise;

        const newDimensions = {
          width: viewport.width,
          height: viewport.height,
        };
        setDimensions(newDimensions);
        setPageHeight(page.getViewport({ scale: 1 }).height);
        onRender?.(newDimensions);
      } catch (error) {
        // Ignore cancellation errors
        if (error instanceof Error && error.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', error);
        }
      } finally {
        setIsRendering(false);
      }
    };

    renderPage();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDocument, pageNumber, scale, rotation, isVisible, onRender]);

  // Draw search highlights on overlay canvas
  React.useEffect(() => {
    const canvas = highlightCanvasRef.current;
    if (!canvas || dimensions.width === 0 || !pageHeight) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const pixelRatio = window.devicePixelRatio || 1;

    // Set canvas size
    canvas.width = Math.floor(dimensions.width * pixelRatio);
    canvas.height = Math.floor(dimensions.height * pixelRatio);
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    context.scale(pixelRatio, pixelRatio);
    context.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw each search result highlight
    searchResults.forEach((result) => {
      const isCurrentMatch = result.index === currentMatchIndex;

      // Transform PDF coordinates (origin at bottom-left) to canvas (origin at top-left)
      const x = result.rect.x * scale;
      const y = (pageHeight - result.rect.y - result.rect.height) * scale;
      const width = result.rect.width * scale;
      const height = result.rect.height * scale;

      // Draw highlight rectangle
      context.fillStyle = isCurrentMatch
        ? 'rgba(255, 150, 0, 0.4)'  // Orange for current match
        : 'rgba(255, 255, 0, 0.35)'; // Yellow for other matches
      context.fillRect(x - 2, y - 2, width + 4, height + 4);

      // Draw border for current match
      if (isCurrentMatch) {
        context.strokeStyle = 'rgba(255, 100, 0, 0.8)';
        context.lineWidth = 2;
        context.strokeRect(x - 2, y - 2, width + 4, height + 4);
      }
    });
  }, [searchResults, currentMatchIndex, dimensions, pageHeight, scale]);

  return (
    <div
      className="relative bg-white shadow-lg"
      style={{
        width: dimensions.width || 'auto',
        height: dimensions.height || 'auto',
        minWidth: 200,
        minHeight: 200,
      }}
    >
      <canvas
        ref={canvasRef}
        className={cn(
          'block',
          isRendering && 'opacity-50'
        )}
      />
      {/* Search highlight overlay canvas */}
      <canvas
        ref={highlightCanvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          width: dimensions.width || 'auto',
          height: dimensions.height || 'auto',
        }}
      />
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}

/**
 * PdfViewer component provides a complete PDF viewing experience with
 * toolbar, thumbnails sidebar, zoom controls, and keyboard navigation.
 *
 * @example
 * ```tsx
 * // Load from file
 * <PdfViewer
 *   file={selectedFile}
 *   onLoad={(metadata) => console.log('Loaded:', metadata.pageCount, 'pages')}
 * />
 *
 * // Load from URL
 * <PdfViewer
 *   url="/documents/sample.pdf"
 *   initialPage={5}
 *   initialZoom={1.5}
 * />
 * ```
 */
export function PdfViewer({
  file,
  url,
  arrayBuffer,
  initialPage = 1,
  initialZoom = 1.0,
  showToolbar = true,
  showThumbnails = true,
  enableReorder = false,
  enableSearch = true,
  onLoad,
  onError,
  onPageChange,
  onZoomChange,
  onReorder,
  className,
}: PdfViewerProps) {
  // PDF document hook
  const {
    pdfDocument,
    loadingState,
    error,
    progress,
    metadata,
    loadFromFile,
    loadFromArrayBuffer,
    loadFromUrl,
  } = usePdfDocument({
    onLoad,
    onError,
    onProgress: (p) => console.log(`Loading: ${p}%`),
  });

  // Search panel visibility state
  const [showSearchPanel, setShowSearchPanel] = React.useState(false);

  // State
  const [currentPage, setCurrentPage] = React.useState(initialPage);
  const [zoom, setZoom] = React.useState(initialZoom);
  const [zoomMode, setZoomMode] = React.useState<ZoomMode>('custom');
  const [rotation, setRotation] = React.useState<0 | 90 | 180 | 270>(0);
  const [activeTool, setActiveTool] = React.useState<ToolType>('select');
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [showThumbnailSidebar] = React.useState(showThumbnails);
  const [visiblePages, setVisiblePages] = React.useState<Set<number>>(new Set([initialPage]));

  // Refs
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const pageRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const pdfDataRef = React.useRef<ArrayBuffer | null>(null);

  // Ref for page change callback (used by search hook)
  const handlePageChangeRef = React.useRef<(page: number) => void>(() => {});

  // Text search hook
  const search = useTextSearch({
    pdfDocument,
    debounceMs: 300,
    onMatchChange: React.useCallback((match: SearchResult | null) => {
      if (match) {
        // Navigate to the page containing the match
        handlePageChangeRef.current(match.page);
      }
    }, []),
  });

  // Load PDF from source
  React.useEffect(() => {
    if (file) {
      // Store the file data for download
      file.arrayBuffer().then((buffer) => {
        pdfDataRef.current = buffer;
      });
      loadFromFile(file);
    } else if (url) {
      loadFromUrl(url);
    } else if (arrayBuffer) {
      pdfDataRef.current = arrayBuffer;
      loadFromArrayBuffer(arrayBuffer);
    }
  }, [file, url, arrayBuffer, loadFromFile, loadFromUrl, loadFromArrayBuffer]);

  // Calculate fit zoom levels
  const calculateFitZoom = React.useCallback(
    async (mode: ZoomMode) => {
      if (!pdfDocument || !scrollContainerRef.current) return;

      try {
        const page = await pdfDocument.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1 });
        const container = scrollContainerRef.current;

        const containerWidth = container.clientWidth - 48; // Padding
        const containerHeight = container.clientHeight - 48;

        let newZoom: number;

        if (mode === 'fit-width') {
          newZoom = containerWidth / viewport.width;
        } else if (mode === 'fit-page') {
          const widthZoom = containerWidth / viewport.width;
          const heightZoom = containerHeight / viewport.height;
          newZoom = Math.min(widthZoom, heightZoom);
        } else {
          return;
        }

        // Clamp zoom
        newZoom = Math.max(0.25, Math.min(5, newZoom));
        setZoom(newZoom);
        onZoomChange?.(newZoom);
      } catch (err) {
        console.error('Error calculating fit zoom:', err);
      }
    },
    [pdfDocument, currentPage, onZoomChange]
  );

  // Handle zoom mode change
  const handleZoomModeChange = React.useCallback(
    (mode: ZoomMode) => {
      setZoomMode(mode);
      if (mode !== 'custom') {
        calculateFitZoom(mode);
      }
    },
    [calculateFitZoom]
  );

  // Recalculate fit zoom on window resize
  React.useEffect(() => {
    if (zoomMode !== 'custom') {
      const handleResize = () => {
        calculateFitZoom(zoomMode);
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [zoomMode, calculateFitZoom]);

  // Handle page change
  const handlePageChange = React.useCallback(
    (page: number) => {
      if (pdfDocument && page >= 1 && page <= pdfDocument.numPages) {
        setCurrentPage(page);
        onPageChange?.(page);

        // Scroll page into view
        const pageElement = pageRefs.current.get(page);
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [pdfDocument, onPageChange]
  );

  // Update page change ref for search hook
  React.useEffect(() => {
    handlePageChangeRef.current = handlePageChange;
  }, [handlePageChange]);

  // Handle search panel close
  const handleCloseSearch = React.useCallback(() => {
    setShowSearchPanel(false);
    search.clearSearch();
  }, [search]);

  // Handle zoom change
  const handleZoomChange = React.useCallback(
    (newZoom: number) => {
      setZoom(newZoom);
      setZoomMode('custom');
      onZoomChange?.(newZoom);
    },
    [onZoomChange]
  );

  // Handle rotation
  const handleRotateClockwise = React.useCallback(() => {
    setRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
  }, []);

  const handleRotateCounterClockwise = React.useCallback(() => {
    setRotation((prev) => ((prev - 90 + 360) % 360) as 0 | 90 | 180 | 270);
  }, []);

  // Handle download
  const handleDownload = React.useCallback(() => {
    if (pdfDataRef.current && metadata) {
      const blob = arrayBufferToBlob(pdfDataRef.current);
      const filename = metadata.title || file?.name || 'document.pdf';
      downloadBlob(blob, filename);
    }
  }, [metadata, file]);

  // Handle fullscreen toggle
  const handleToggleFullscreen = React.useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // Listen for fullscreen changes
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Intersection observer for lazy loading pages
  React.useEffect(() => {
    if (!pdfDocument) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNumber = parseInt(
            entry.target.getAttribute('data-page') || '0',
            10
          );
          if (pageNumber > 0) {
            setVisiblePages((prev) => {
              const next = new Set(prev);
              if (entry.isIntersecting) {
                next.add(pageNumber);
              }
              // Keep pages visible once rendered for smoother scrolling
              return next;
            });

            // Update current page based on most visible page
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
              setCurrentPage(pageNumber);
              onPageChange?.(pageNumber);
            }
          }
        });
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '100px',
        threshold: [0, 0.5, 1],
      }
    );

    pageRefs.current.forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [pdfDocument, onPageChange]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key;

      // Page navigation
      if (KEYBOARD_SHORTCUTS.nextPage.includes(key)) {
        e.preventDefault();
        handlePageChange(currentPage + 1);
      } else if (KEYBOARD_SHORTCUTS.prevPage.includes(key)) {
        e.preventDefault();
        handlePageChange(currentPage - 1);
      }
      // Zoom controls (with Ctrl/Cmd)
      else if (KEYBOARD_SHORTCUTS.zoomIn.includes(key) && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleZoomChange(Math.min(zoom + 0.25, 5));
      } else if (KEYBOARD_SHORTCUTS.zoomOut.includes(key) && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleZoomChange(Math.max(zoom - 0.25, 0.25));
      }
      // Fullscreen
      else if (KEYBOARD_SHORTCUTS.fullscreen.includes(key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleToggleFullscreen();
      }
      // Exit fullscreen
      else if (KEYBOARD_SHORTCUTS.escape.includes(key) && isFullscreen) {
        e.preventDefault();
        handleToggleFullscreen();
      }
      // Download (with Ctrl/Cmd)
      else if (KEYBOARD_SHORTCUTS.download.includes(key) && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleDownload();
      }
      // Search (with Ctrl/Cmd)
      else if (KEYBOARD_SHORTCUTS.search.includes(key) && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (enableSearch) {
          setShowSearchPanel(true);
        }
      }
      // Tool shortcuts
      else if (KEYBOARD_SHORTCUTS.selectTool.includes(key) && !e.ctrlKey && !e.metaKey) {
        setActiveTool('select');
      } else if (KEYBOARD_SHORTCUTS.handTool.includes(key) && !e.ctrlKey && !e.metaKey) {
        setActiveTool('hand');
      } else if (KEYBOARD_SHORTCUTS.textTool.includes(key) && !e.ctrlKey && !e.metaKey) {
        setActiveTool('text');
      } else if (KEYBOARD_SHORTCUTS.highlightTool.includes(key) && !e.ctrlKey && !e.metaKey) {
        setActiveTool('highlight');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentPage,
    zoom,
    isFullscreen,
    enableSearch,
    handlePageChange,
    handleZoomChange,
    handleToggleFullscreen,
    handleDownload,
  ]);

  // Render loading state
  if (loadingState === 'loading') {
    return (
      <div className={cn('flex h-full flex-col', className)}>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <div className="text-sm text-muted-foreground">
              Loading PDF... {progress}%
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (loadingState === 'error' || error) {
    return (
      <div className={cn('flex h-full flex-col', className)}>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-destructive">
              <svg
                className="h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="text-lg font-medium">Failed to load PDF</div>
            <div className="text-sm text-muted-foreground">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!pdfDocument || loadingState === 'idle') {
    return (
      <div className={cn('flex h-full flex-col', className)}>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm text-muted-foreground">
            No PDF document loaded
          </div>
        </div>
      </div>
    );
  }

  const totalPages = pdfDocument.numPages;

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full flex-col bg-background',
        isFullscreen && 'fixed inset-0 z-50',
        className
      )}
    >
      {/* Toolbar */}
      {showToolbar && (
        <EditToolbar
          currentPage={currentPage}
          totalPages={totalPages}
          zoom={zoom}
          zoomMode={zoomMode}
          activeTool={activeTool}
          isFullscreen={isFullscreen}
          onPageChange={handlePageChange}
          onZoomChange={handleZoomChange}
          onZoomModeChange={handleZoomModeChange}
          onRotateClockwise={handleRotateClockwise}
          onRotateCounterClockwise={handleRotateCounterClockwise}
          onDownload={handleDownload}
          onToggleFullscreen={handleToggleFullscreen}
          onToolChange={setActiveTool}
        />
      )}

      {/* Search Panel */}
      {enableSearch && showSearchPanel && (
        <SearchPanel
          query={search.query}
          onQueryChange={search.setQuery}
          options={search.options}
          onOptionsChange={search.setOptions}
          results={search.results}
          searchState={search.searchState}
          error={search.error}
          currentMatchIndex={search.currentMatchIndex}
          matchCount={search.matchCount}
          onNextMatch={search.nextMatch}
          onPrevMatch={search.prevMatch}
          onGoToMatch={search.goToMatch}
          onClear={search.clearSearch}
          onClose={handleCloseSearch}
          replaceText={search.replaceText}
          onReplaceTextChange={search.setReplaceText}
          onReplaceCurrent={search.replaceCurrent}
          onReplaceAll={search.replaceAll}
          isReplacing={search.isReplacing}
        />
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnail Sidebar */}
        {showThumbnailSidebar && (
          <PageThumbnails
            pdfDocument={pdfDocument}
            currentPage={currentPage}
            enableReorder={enableReorder}
            onPageSelect={handlePageChange}
            onReorder={onReorder}
          />
        )}

        {/* Page Viewer */}
        <div
          ref={scrollContainerRef}
          className={cn(
            'flex-1 overflow-auto bg-muted/50',
            activeTool === 'hand' && 'cursor-grab active:cursor-grabbing'
          )}
        >
          <div className="flex flex-col items-center gap-4 p-6">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (pageNumber) => (
                <div
                  key={pageNumber}
                  ref={(el) => {
                    if (el) {
                      pageRefs.current.set(pageNumber, el);
                    } else {
                      pageRefs.current.delete(pageNumber);
                    }
                  }}
                  data-page={pageNumber}
                  className="scroll-mt-6"
                >
                  <PageCanvas
                    pdfDocument={pdfDocument}
                    pageNumber={pageNumber}
                    scale={zoom}
                    rotation={rotation}
                    isVisible={visiblePages.has(pageNumber)}
                    searchResults={search.matchesOnPage(pageNumber)}
                    currentMatchIndex={search.currentMatchIndex}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

PdfViewer.displayName = 'PdfViewer';

export default PdfViewer;
