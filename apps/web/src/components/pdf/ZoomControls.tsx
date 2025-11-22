/**
 * ZoomControls Component
 * Provides zoom control functionality for the PDF viewer
 */

import * as React from 'react';
import { ZoomIn, ZoomOut, Maximize, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Preset zoom levels available in the dropdown
 */
export const ZOOM_PRESETS = [
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1.0 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2.0 },
  { label: '300%', value: 3.0 },
] as const;

/**
 * Special zoom modes
 */
export type ZoomMode = 'fit-width' | 'fit-page' | 'custom';

/**
 * Props for the ZoomControls component
 */
export interface ZoomControlsProps {
  /** Current zoom level (1.0 = 100%) */
  zoom: number;
  /** Current zoom mode */
  zoomMode?: ZoomMode;
  /** Minimum allowed zoom level */
  minZoom?: number;
  /** Maximum allowed zoom level */
  maxZoom?: number;
  /** Zoom step for increment/decrement */
  zoomStep?: number;
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Callback when zoom level changes */
  onZoomChange: (zoom: number) => void;
  /** Callback when zoom mode changes */
  onZoomModeChange?: (mode: ZoomMode) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ZoomControls component provides zoom in/out buttons, a zoom level selector,
 * and fit-to-width/fit-to-page options for the PDF viewer.
 *
 * @example
 * ```tsx
 * <ZoomControls
 *   zoom={1.5}
 *   onZoomChange={(zoom) => setZoom(zoom)}
 *   onZoomModeChange={(mode) => setZoomMode(mode)}
 * />
 * ```
 */
export function ZoomControls({
  zoom,
  zoomMode = 'custom',
  minZoom = 0.25,
  maxZoom = 5.0,
  zoomStep = 0.25,
  disabled = false,
  onZoomChange,
  onZoomModeChange,
  className,
}: ZoomControlsProps) {
  /**
   * Handle zoom in
   */
  const handleZoomIn = React.useCallback(() => {
    const newZoom = Math.min(zoom + zoomStep, maxZoom);
    onZoomChange(newZoom);
    onZoomModeChange?.('custom');
  }, [zoom, zoomStep, maxZoom, onZoomChange, onZoomModeChange]);

  /**
   * Handle zoom out
   */
  const handleZoomOut = React.useCallback(() => {
    const newZoom = Math.max(zoom - zoomStep, minZoom);
    onZoomChange(newZoom);
    onZoomModeChange?.('custom');
  }, [zoom, zoomStep, minZoom, onZoomChange, onZoomModeChange]);

  /**
   * Handle preset zoom selection
   */
  const handlePresetSelect = React.useCallback(
    (value: number) => {
      onZoomChange(value);
      onZoomModeChange?.('custom');
    },
    [onZoomChange, onZoomModeChange]
  );

  /**
   * Handle fit to width
   */
  const handleFitWidth = React.useCallback(() => {
    onZoomModeChange?.('fit-width');
  }, [onZoomModeChange]);

  /**
   * Handle fit to page
   */
  const handleFitPage = React.useCallback(() => {
    onZoomModeChange?.('fit-page');
  }, [onZoomModeChange]);

  /**
   * Format zoom level for display
   */
  const zoomPercentage = React.useMemo(
    () => `${Math.round(zoom * 100)}%`,
    [zoom]
  );

  /**
   * Check if zoom in/out should be disabled
   */
  const canZoomIn = zoom < maxZoom && !disabled;
  const canZoomOut = zoom > minZoom && !disabled;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Zoom Out Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={!canZoomOut}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Zoom out (Ctrl+-)</p>
        </TooltipContent>
      </Tooltip>

      {/* Zoom Level Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="min-w-[4.5rem] font-mono text-sm"
            aria-label={`Current zoom: ${zoomPercentage}`}
          >
            {zoomPercentage}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {ZOOM_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.value}
              onClick={() => handlePresetSelect(preset.value)}
              className={cn(
                'font-mono',
                zoom === preset.value && 'bg-accent'
              )}
            >
              {preset.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Zoom In Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={!canZoomIn}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Zoom in (Ctrl++)</p>
        </TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className="mx-1 h-6 w-px bg-border" />

      {/* Fit to Width Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={zoomMode === 'fit-width' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={handleFitWidth}
            disabled={disabled}
            aria-label="Fit to width"
            aria-pressed={zoomMode === 'fit-width'}
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Fit to width</p>
        </TooltipContent>
      </Tooltip>

      {/* Fit to Page Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={zoomMode === 'fit-page' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={handleFitPage}
            disabled={disabled}
            aria-label="Fit to page"
            aria-pressed={zoomMode === 'fit-page'}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Fit to page</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

ZoomControls.displayName = 'ZoomControls';

export default ZoomControls;
