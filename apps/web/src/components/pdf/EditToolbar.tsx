/**
 * EditToolbar Component
 * Provides editing tools and controls for the PDF viewer
 */

import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  RotateCcw,
  Download,
  Maximize2,
  Minimize2,
  Hand,
  MousePointer2,
  Type,
  Highlighter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ZoomControls, type ZoomMode } from './ZoomControls';
import { cn } from '@/lib/utils';

/**
 * Available tools in the toolbar
 */
export type ToolType = 'select' | 'hand' | 'text' | 'highlight';

/**
 * Props for the EditToolbar component
 */
export interface EditToolbarProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Current zoom level (1.0 = 100%) */
  zoom: number;
  /** Current zoom mode */
  zoomMode?: ZoomMode;
  /** Currently active tool */
  activeTool?: ToolType;
  /** Whether fullscreen mode is active */
  isFullscreen?: boolean;
  /** Whether the toolbar is disabled */
  disabled?: boolean;
  /** Whether annotation tools are available */
  enableAnnotations?: boolean;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when zoom changes */
  onZoomChange: (zoom: number) => void;
  /** Callback when zoom mode changes */
  onZoomModeChange?: (mode: ZoomMode) => void;
  /** Callback when rotate clockwise is clicked */
  onRotateClockwise?: () => void;
  /** Callback when rotate counter-clockwise is clicked */
  onRotateCounterClockwise?: () => void;
  /** Callback when download is clicked */
  onDownload?: () => void;
  /** Callback when fullscreen is toggled */
  onToggleFullscreen?: () => void;
  /** Callback when tool changes */
  onToolChange?: (tool: ToolType) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * EditToolbar component provides a comprehensive toolbar for PDF viewing and editing,
 * including page navigation, zoom controls, rotation, download, and various tools.
 *
 * @example
 * ```tsx
 * <EditToolbar
 *   currentPage={1}
 *   totalPages={10}
 *   zoom={1.0}
 *   onPageChange={setCurrentPage}
 *   onZoomChange={setZoom}
 *   onDownload={handleDownload}
 * />
 * ```
 */
export function EditToolbar({
  currentPage,
  totalPages,
  zoom,
  zoomMode = 'custom',
  activeTool = 'select',
  isFullscreen = false,
  disabled = false,
  enableAnnotations = true,
  onPageChange,
  onZoomChange,
  onZoomModeChange,
  onRotateClockwise,
  onRotateCounterClockwise,
  onDownload,
  onToggleFullscreen,
  onToolChange,
  className,
}: EditToolbarProps) {
  const [pageInput, setPageInput] = React.useState(String(currentPage));

  // Sync page input with current page
  React.useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  /**
   * Handle previous page navigation
   */
  const handlePrevPage = React.useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  /**
   * Handle next page navigation
   */
  const handleNextPage = React.useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  /**
   * Handle page input change
   */
  const handlePageInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPageInput(e.target.value);
    },
    []
  );

  /**
   * Handle page input blur or enter key
   */
  const handlePageInputSubmit = React.useCallback(() => {
    const page = parseInt(pageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
    } else {
      setPageInput(String(currentPage));
    }
  }, [pageInput, totalPages, currentPage, onPageChange]);

  /**
   * Handle key press in page input
   */
  const handlePageInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handlePageInputSubmit();
        (e.target as HTMLInputElement).blur();
      } else if (e.key === 'Escape') {
        setPageInput(String(currentPage));
        (e.target as HTMLInputElement).blur();
      }
    },
    [handlePageInputSubmit, currentPage]
  );

  const canGoPrev = currentPage > 1 && !disabled;
  const canGoNext = currentPage < totalPages && !disabled;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b bg-background px-4 py-2',
        className
      )}
    >
      {/* Left Section: Tools */}
      <div className="flex items-center gap-1">
        {/* Select Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === 'select' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => onToolChange?.('select')}
              disabled={disabled}
              aria-label="Select tool"
              aria-pressed={activeTool === 'select'}
            >
              <MousePointer2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Select (V)</p>
          </TooltipContent>
        </Tooltip>

        {/* Hand Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === 'hand' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => onToolChange?.('hand')}
              disabled={disabled}
              aria-label="Hand tool"
              aria-pressed={activeTool === 'hand'}
            >
              <Hand className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Hand tool (H)</p>
          </TooltipContent>
        </Tooltip>

        {/* Text Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === 'text' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => onToolChange?.('text')}
              disabled={disabled}
              aria-label="Text selection tool"
              aria-pressed={activeTool === 'text'}
            >
              <Type className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Text selection (T)</p>
          </TooltipContent>
        </Tooltip>

        {/* Highlight Tool */}
        {enableAnnotations && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'highlight' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => onToolChange?.('highlight')}
                disabled={disabled}
                aria-label="Highlight tool"
                aria-pressed={activeTool === 'highlight'}
              >
                <Highlighter className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Highlight (L)</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Center Section: Page Navigation and Zoom */}
      <div className="flex items-center gap-4">
        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevPage}
                disabled={!canGoPrev}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Previous page (Left arrow)</p>
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-1.5">
            <Input
              type="text"
              value={pageInput}
              onChange={handlePageInputChange}
              onBlur={handlePageInputSubmit}
              onKeyDown={handlePageInputKeyDown}
              disabled={disabled}
              className="h-8 w-12 px-2 text-center font-mono text-sm"
              aria-label="Page number"
            />
            <span className="text-sm text-muted-foreground">
              / {totalPages}
            </span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextPage}
                disabled={!canGoNext}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Next page (Right arrow)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Zoom Controls */}
        <ZoomControls
          zoom={zoom}
          zoomMode={zoomMode}
          disabled={disabled}
          onZoomChange={onZoomChange}
          onZoomModeChange={onZoomModeChange}
        />
      </div>

      {/* Right Section: Actions */}
      <div className="flex items-center gap-1">
        {/* Rotate Counter-Clockwise */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRotateCounterClockwise}
              disabled={disabled || !onRotateCounterClockwise}
              aria-label="Rotate counter-clockwise"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Rotate left</p>
          </TooltipContent>
        </Tooltip>

        {/* Rotate Clockwise */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRotateClockwise}
              disabled={disabled || !onRotateClockwise}
              aria-label="Rotate clockwise"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Rotate right</p>
          </TooltipContent>
        </Tooltip>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-border" />

        {/* Download */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDownload}
              disabled={disabled || !onDownload}
              aria-label="Download PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Download (Ctrl+S)</p>
          </TooltipContent>
        </Tooltip>

        {/* Fullscreen Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFullscreen}
              disabled={disabled || !onToggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (F)'}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

EditToolbar.displayName = 'EditToolbar';

export default EditToolbar;
