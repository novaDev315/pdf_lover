/**
 * CompareViewer Component
 *
 * Side-by-side PDF comparison viewer with synchronized scrolling,
 * difference highlighting, and overlay mode support.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  SplitSquareHorizontal,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { DiffOverlay } from './DiffOverlay';

/**
 * Re-define types locally to avoid build dependency issues
 * These mirror the types from @pdflover/pdf-core
 */
export type DifferenceType = 'text' | 'image' | 'layout' | 'addition' | 'deletion' | 'modification';

export interface Difference {
  type: DifferenceType;
  pageNumber: number;
  location: { x: number; y: number; width: number; height: number };
  oldValue: string | null;
  newValue: string | null;
  description?: string;
}

export interface PageComparison {
  pageNum: number;
  differences: Difference[];
  similarity: number;
  textSimilarity: number;
  visualSimilarity?: number;
  sameDimensions: boolean;
  diffImageDataUrl?: string;
}

export interface ComparisonSummary {
  pdf1PageCount: number;
  pdf2PageCount: number;
  pagesChanged: number;
  pagesIdentical: number;
  textChanges: number;
  textAdditions: number;
  textDeletions: number;
  textModifications: number;
  overallSimilarity: number;
  visualSimilarity?: number;
  duration: number;
}

export interface ComparisonResult {
  pages: PageComparison[];
  summary: ComparisonSummary;
}

/**
 * View mode options
 */
export type ViewMode = 'side-by-side' | 'overlay';

/**
 * Props for the CompareViewer component
 */
export interface CompareViewerProps {
  /** PDF 1 data URL or object URL */
  pdf1Url: string | null;
  /** PDF 2 data URL or object URL */
  pdf2Url: string | null;
  /** PDF 1 filename */
  pdf1Name?: string;
  /** PDF 2 filename */
  pdf2Name?: string;
  /** Comparison result data */
  comparisonResult: ComparisonResult | null;
  /** Current page number (1-indexed) */
  currentPage?: number;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Currently highlighted difference index */
  currentDifferenceIndex?: number;
  /** Callback when navigating differences */
  onDifferenceNavigate?: (direction: 'prev' | 'next') => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Simple PDF page renderer using object/iframe
 */
interface PdfPanelProps {
  url: string | null;
  title: string;
  pageNum: number;
  zoom: number;
  pageComparison?: PageComparison | null;
  showOverlay: boolean;
  overlayOpacity: number;
  onOpacityChange: (opacity: number) => void;
  currentDifferenceIndex?: number;
  onDifferenceClick?: (diff: Difference, index: number) => void;
  onScroll?: (scrollTop: number, scrollLeft: number) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

function PdfPanel({
  url,
  title,
  pageNum,
  zoom,
  pageComparison,
  showOverlay,
  overlayOpacity,
  onOpacityChange,
  currentDifferenceIndex,
  onDifferenceClick,
  onScroll,
  scrollRef,
}: PdfPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle scroll synchronization
  const handleScroll = useCallback(() => {
    if (containerRef.current && onScroll) {
      onScroll(containerRef.current.scrollTop, containerRef.current.scrollLeft);
    }
  }, [onScroll]);

  // Set scroll position from external ref
  useEffect(() => {
    if (scrollRef?.current && containerRef.current) {
      // Sync scroll position from the other panel
    }
  }, [scrollRef]);

  if (!url) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-100 dark:bg-surface-800 rounded-lg border border-dashed border-surface-300 dark:border-surface-600">
        <p className="text-surface-500 dark:text-surface-400">
          No PDF loaded
        </p>
      </div>
    );
  }

  const iframeWidth = Math.round(600 * zoom);
  const iframeHeight = Math.round(800 * zoom);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Panel header */}
      <div className="px-4 py-2 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 rounded-t-lg">
        <h3 className="font-medium text-sm text-surface-700 dark:text-surface-300 truncate">
          {title}
        </h3>
        {pageComparison && (
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className={cn(
              'px-2 py-0.5 rounded-full',
              pageComparison.similarity >= 90
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : pageComparison.similarity >= 50
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            )}>
              {pageComparison.similarity}% similar
            </span>
            {pageComparison.differences.length > 0 && (
              <span className="text-surface-500 dark:text-surface-400">
                {pageComparison.differences.length} difference{pageComparison.differences.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* PDF viewer */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-surface-200 dark:bg-surface-900 relative"
        onScroll={handleScroll}
      >
        <div className="relative" style={{ width: iframeWidth, height: iframeHeight }}>
          <iframe
            src={`${url}#page=${pageNum}&zoom=${Math.round(zoom * 100)}`}
            className="w-full h-full border-0"
            title={title}
          />

          {/* Diff overlay */}
          {showOverlay && pageComparison && (
            <DiffOverlay
              pageComparison={pageComparison}
              width={iframeWidth}
              height={iframeHeight}
              scale={zoom}
              visible={showOverlay}
              opacity={overlayOpacity}
              onOpacityChange={onOpacityChange}
              highlightedDifferenceIndex={currentDifferenceIndex}
              onDifferenceClick={onDifferenceClick}
              showOpacityControl={false}
              className="absolute inset-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * CompareViewer Component
 *
 * Displays two PDFs side by side with synchronized scrolling
 * and difference highlighting capabilities.
 */
export function CompareViewer({
  pdf1Url,
  pdf2Url,
  pdf1Name = 'Original PDF',
  pdf2Name = 'Modified PDF',
  comparisonResult,
  currentPage = 1,
  onPageChange,
  currentDifferenceIndex = 0,
  onDifferenceNavigate,
  className,
}: CompareViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [zoom, setZoom] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [syncScroll, setSyncScroll] = useState(true);

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Get total pages
  const totalPages = comparisonResult
    ? Math.max(comparisonResult.summary.pdf1PageCount, comparisonResult.summary.pdf2PageCount)
    : 1;

  // Get current page comparison
  const currentPageComparison = comparisonResult?.pages.find(p => p.pageNum === currentPage) ?? null;

  // Total differences count
  const totalDifferences = comparisonResult?.pages.reduce(
    (sum, page) => sum + page.differences.length,
    0
  ) ?? 0;

  /**
   * Handle synchronized scrolling
   */
  const handleLeftScroll = useCallback((scrollTop: number, scrollLeft: number) => {
    if (syncScroll && rightPanelRef.current) {
      rightPanelRef.current.scrollTop = scrollTop;
      rightPanelRef.current.scrollLeft = scrollLeft;
    }
  }, [syncScroll]);

  const handleRightScroll = useCallback((scrollTop: number, scrollLeft: number) => {
    if (syncScroll && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = scrollTop;
      leftPanelRef.current.scrollLeft = scrollLeft;
    }
  }, [syncScroll]);

  /**
   * Handle difference click
   */
  const handleDifferenceClick = useCallback((diff: Difference, _index: number) => {
    // Navigate to the page containing the difference
    if (diff.pageNumber !== currentPage) {
      onPageChange?.(diff.pageNumber);
    }
  }, [currentPage, onPageChange]);

  /**
   * Zoom controls
   */
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  /**
   * Page navigation
   */
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange?.(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange?.(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <Toggle
            pressed={viewMode === 'side-by-side'}
            onPressedChange={() => setViewMode('side-by-side')}
            size="sm"
            aria-label="Side by side view"
          >
            <SplitSquareHorizontal className="h-4 w-4" />
          </Toggle>
          <Toggle
            pressed={viewMode === 'overlay'}
            onPressedChange={() => setViewMode('overlay')}
            size="sm"
            aria-label="Overlay view"
          >
            <Layers className="h-4 w-4" />
          </Toggle>

          <div className="w-px h-6 bg-surface-200 dark:bg-surface-700 mx-2" />

          <Toggle
            pressed={showOverlay}
            onPressedChange={setShowOverlay}
            size="sm"
            aria-label="Toggle diff overlay"
          >
            <span className="text-xs">Diff</span>
          </Toggle>

          <Toggle
            pressed={syncScroll}
            onPressedChange={setSyncScroll}
            size="sm"
            aria-label="Sync scroll"
          >
            <span className="text-xs">Sync</span>
          </Toggle>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-surface-600 dark:text-surface-400">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-surface-600 dark:text-surface-400 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Difference navigation */}
        {totalDifferences > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDifferenceNavigate?.('prev')}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <span className="text-sm text-surface-600 dark:text-surface-400">
              {currentDifferenceIndex + 1} / {totalDifferences}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDifferenceNavigate?.('next')}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Viewer area */}
      <div className="flex-1 flex gap-2 p-2 bg-surface-100 dark:bg-surface-950 overflow-hidden">
        {viewMode === 'side-by-side' ? (
          <>
            {/* Left panel - PDF 1 */}
            <PdfPanel
              url={pdf1Url}
              title={pdf1Name}
              pageNum={currentPage}
              zoom={zoom}
              pageComparison={currentPageComparison}
              showOverlay={showOverlay}
              overlayOpacity={overlayOpacity}
              onOpacityChange={setOverlayOpacity}
              currentDifferenceIndex={currentDifferenceIndex}
              onDifferenceClick={handleDifferenceClick}
              onScroll={handleLeftScroll}
              scrollRef={leftPanelRef}
            />

            {/* Right panel - PDF 2 */}
            <PdfPanel
              url={pdf2Url}
              title={pdf2Name}
              pageNum={currentPage}
              zoom={zoom}
              pageComparison={currentPageComparison}
              showOverlay={showOverlay}
              overlayOpacity={overlayOpacity}
              onOpacityChange={setOverlayOpacity}
              currentDifferenceIndex={currentDifferenceIndex}
              onDifferenceClick={handleDifferenceClick}
              onScroll={handleRightScroll}
              scrollRef={rightPanelRef}
            />
          </>
        ) : (
          /* Overlay mode - single panel with both PDFs */
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-4 px-4 py-2 bg-surface-100 dark:bg-surface-800 rounded-t-lg border-b border-surface-200 dark:border-surface-700">
              <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Overlay Mode
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-surface-500">Opacity:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={overlayOpacity * 100}
                  onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                  className="w-24"
                />
                <span className="text-xs text-surface-500 w-8">
                  {Math.round(overlayOpacity * 100)}%
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-surface-200 dark:bg-surface-900 relative">
              <div
                className="relative"
                style={{
                  width: Math.round(600 * zoom),
                  height: Math.round(800 * zoom),
                }}
              >
                {/* Base layer - PDF 1 */}
                {pdf1Url && (
                  <iframe
                    src={`${pdf1Url}#page=${currentPage}&zoom=${Math.round(zoom * 100)}`}
                    className="absolute inset-0 w-full h-full border-0"
                    title={pdf1Name}
                  />
                )}

                {/* Overlay layer - PDF 2 with opacity */}
                {pdf2Url && (
                  <iframe
                    src={`${pdf2Url}#page=${currentPage}&zoom=${Math.round(zoom * 100)}`}
                    className="absolute inset-0 w-full h-full border-0"
                    style={{ opacity: overlayOpacity }}
                    title={pdf2Name}
                  />
                )}

                {/* Diff overlay */}
                {showOverlay && currentPageComparison && (
                  <DiffOverlay
                    pageComparison={currentPageComparison}
                    width={Math.round(600 * zoom)}
                    height={Math.round(800 * zoom)}
                    scale={zoom}
                    visible={showOverlay}
                    opacity={0.5}
                    onOpacityChange={() => {}}
                    highlightedDifferenceIndex={currentDifferenceIndex}
                    onDifferenceClick={handleDifferenceClick}
                    showOpacityControl={false}
                    className="absolute inset-0 pointer-events-none"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompareViewer;
