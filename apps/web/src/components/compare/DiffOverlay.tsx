/**
 * DiffOverlay Component
 *
 * Canvas overlay for displaying PDF comparison differences
 * with color-coded highlights for additions, deletions, and changes.
 */

import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

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

/**
 * Color configuration for difference highlighting
 */
export interface DiffColors {
  /** Color for additions (default: green) */
  addition: string;
  /** Color for deletions (default: red) */
  deletion: string;
  /** Color for modifications (default: yellow) */
  modification: string;
  /** Color for layout changes (default: blue) */
  layout: string;
}

/**
 * Props for the DiffOverlay component
 */
export interface DiffOverlayProps {
  /** Page comparison data */
  pageComparison: PageComparison | null;
  /** Page width in pixels */
  width: number;
  /** Page height in pixels */
  height: number;
  /** Scale factor for PDF rendering */
  scale?: number;
  /** Whether the overlay is visible */
  visible?: boolean;
  /** Overlay opacity (0-1) */
  opacity?: number;
  /** Callback when opacity changes */
  onOpacityChange?: (opacity: number) => void;
  /** Custom colors for highlighting */
  colors?: Partial<DiffColors>;
  /** Whether to show opacity control */
  showOpacityControl?: boolean;
  /** Currently highlighted difference index */
  highlightedDifferenceIndex?: number;
  /** Callback when a difference is clicked */
  onDifferenceClick?: (difference: Difference, index: number) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Default colors for difference highlighting
 */
const defaultColors: DiffColors = {
  addition: 'rgba(34, 197, 94, 0.4)',    // Green
  deletion: 'rgba(239, 68, 68, 0.4)',     // Red
  modification: 'rgba(234, 179, 8, 0.4)', // Yellow
  layout: 'rgba(59, 130, 246, 0.4)',      // Blue
};

/**
 * Get color for a difference type
 */
function getColorForType(type: Difference['type'], colors: DiffColors): string {
  switch (type) {
    case 'addition':
      return colors.addition;
    case 'deletion':
      return colors.deletion;
    case 'modification':
    case 'text':
    case 'image':
      return colors.modification;
    case 'layout':
      return colors.layout;
    default:
      return colors.modification;
  }
}

/**
 * DiffOverlay Component
 *
 * Renders a canvas overlay showing differences between PDF pages.
 * Supports color-coded highlighting and opacity control.
 */
export function DiffOverlay({
  pageComparison,
  width,
  height,
  scale = 1,
  visible = true,
  opacity = 0.5,
  onOpacityChange,
  colors: customColors,
  showOpacityControl = true,
  highlightedDifferenceIndex,
  onDifferenceClick,
  className,
}: DiffOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colors: DiffColors = { ...defaultColors, ...customColors };

  /**
   * Draw differences on the canvas
   */
  const drawDifferences = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pageComparison) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set global alpha for opacity
    ctx.globalAlpha = opacity;

    // Draw each difference
    pageComparison.differences.forEach((diff, index) => {
      const { location, type } = diff;

      // Scale the location coordinates
      const x = location.x * scale;
      const y = location.y * scale;
      const w = location.width * scale || 100;
      const h = location.height * scale || 20;

      // Get color for this difference type
      const fillColor = getColorForType(type, colors);

      // Draw the highlight rectangle
      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, w, h);

      // Add border if this difference is highlighted
      if (highlightedDifferenceIndex === index) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
      }

      // Draw indicator icon/marker
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.font = `${12 * scale}px sans-serif`;
      ctx.fillText(getTypeIcon(type), x + 4, y + 14 * scale);
    });

    // Reset global alpha
    ctx.globalAlpha = 1;
  }, [pageComparison, opacity, scale, colors, highlightedDifferenceIndex]);

  /**
   * Get icon character for difference type
   */
  function getTypeIcon(type: Difference['type']): string {
    switch (type) {
      case 'addition':
        return '+';
      case 'deletion':
        return '-';
      case 'modification':
      case 'text':
        return '~';
      case 'image':
        return 'I';
      case 'layout':
        return 'L';
      default:
        return '?';
    }
  }

  /**
   * Handle canvas click to detect difference clicks
   */
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pageComparison || !onDifferenceClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) / scale;
    const clickY = (event.clientY - rect.top) / scale;

    // Check if click is within any difference bounds
    for (let i = 0; i < pageComparison.differences.length; i++) {
      const diff = pageComparison.differences[i]!;
      const { location } = diff;
      const w = location.width || 100;
      const h = location.height || 20;

      if (
        clickX >= location.x &&
        clickX <= location.x + w &&
        clickY >= location.y &&
        clickY <= location.y + h
      ) {
        onDifferenceClick(diff, i);
        return;
      }
    }
  }, [pageComparison, onDifferenceClick, scale]);

  // Redraw when dependencies change
  useEffect(() => {
    if (visible) {
      drawDifferences();
    }
  }, [visible, drawDifferences]);

  // Update canvas size when dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
      if (visible) {
        drawDifferences();
      }
    }
  }, [width, height, visible, drawDifferences]);

  if (!visible || !pageComparison) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        className="absolute top-0 left-0 pointer-events-auto cursor-pointer"
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      />

      {/* Opacity control */}
      {showOpacityControl && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/90 dark:bg-surface-800/90 rounded-lg p-3 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs text-surface-600 dark:text-surface-400 whitespace-nowrap">
              Opacity
            </span>
            <Slider
              value={[opacity * 100]}
              onValueChange={([value]) => onOpacityChange?.(value! / 100)}
              min={0}
              max={100}
              step={5}
              className="flex-1"
            />
            <span className="text-xs text-surface-600 dark:text-surface-400 w-8 text-right">
              {Math.round(opacity * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white/90 dark:bg-surface-800/90 rounded-lg p-2 shadow-lg backdrop-blur-sm text-xs">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors.addition }}
            />
            <span className="text-surface-600 dark:text-surface-400">Added</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors.deletion }}
            />
            <span className="text-surface-600 dark:text-surface-400">Removed</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors.modification }}
            />
            <span className="text-surface-600 dark:text-surface-400">Changed</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors.layout }}
            />
            <span className="text-surface-600 dark:text-surface-400">Layout</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiffOverlay;
