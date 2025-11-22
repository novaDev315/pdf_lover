/**
 * ShapeDrawer Component
 * Interactive component for drawing and editing shapes on PDF pages
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  type Point,
  type Rect,
  type Color,
  type ShapeAnnotation,
  type LineAnnotation,
  type ArrowAnnotation,
} from '@/store/annotation-store';

/**
 * Shape types supported by the drawer
 */
export type ShapeType = 'rectangle' | 'circle' | 'ellipse' | 'line' | 'arrow';

/**
 * Handle position enum
 */
export type HandlePosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';

/**
 * Props for ShapeDrawer component
 */
export interface ShapeDrawerProps {
  /** Type of shape being drawn */
  shapeType: ShapeType;
  /** Current drawing state */
  isDrawing: boolean;
  /** Starting point of the shape */
  startPoint: Point | null;
  /** Current end point while drawing */
  endPoint: Point | null;
  /** Shape style options */
  strokeColor?: Color;
  fillColor?: Color;
  strokeWidth?: number;
  filled?: boolean;
  opacity?: number;
  /** Scale factor for rendering */
  scale?: number;
  /** Callback when shape drawing is complete */
  onComplete?: (rect: Rect, startPoint: Point, endPoint: Point) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Convert Color to CSS rgba string
 */
function colorToRgba(color: Color, opacity: number = 1): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Calculate bounding rect from two points
 */
function calculateRect(start: Point, end: Point): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

/**
 * ShapeDrawer component
 * Renders shape preview while drawing
 */
export function ShapeDrawer({
  shapeType,
  isDrawing,
  startPoint,
  endPoint,
  strokeColor = { r: 0, g: 0, b: 0 },
  fillColor = { r: 1, g: 1, b: 1 },
  strokeWidth = 2,
  filled = false,
  opacity = 1,
  scale = 1,
  className,
}: ShapeDrawerProps) {
  if (!isDrawing || !startPoint || !endPoint) {
    return null;
  }

  const rect = calculateRect(startPoint, endPoint);

  // SVG styles
  const strokeStyle = colorToRgba(strokeColor, opacity);
  const fillStyle = filled ? colorToRgba(fillColor, opacity) : 'transparent';

  const renderShape = () => {
    const x = rect.x * scale;
    const y = rect.y * scale;
    const width = rect.width * scale;
    const height = rect.height * scale;

    switch (shapeType) {
      case 'rectangle':
        return (
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            stroke={strokeStyle}
            strokeWidth={strokeWidth * scale}
            fill={fillStyle}
            strokeDasharray="5,5"
          />
        );

      case 'circle': {
        const radius = Math.min(width, height) / 2;
        const cx = x + width / 2;
        const cy = y + height / 2;
        return (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={strokeStyle}
            strokeWidth={strokeWidth * scale}
            fill={fillStyle}
            strokeDasharray="5,5"
          />
        );
      }

      case 'ellipse': {
        const cx = x + width / 2;
        const cy = y + height / 2;
        const rx = width / 2;
        const ry = height / 2;
        return (
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            stroke={strokeStyle}
            strokeWidth={strokeWidth * scale}
            fill={fillStyle}
            strokeDasharray="5,5"
          />
        );
      }

      case 'line':
        return (
          <line
            x1={startPoint.x * scale}
            y1={startPoint.y * scale}
            x2={endPoint.x * scale}
            y2={endPoint.y * scale}
            stroke={strokeStyle}
            strokeWidth={strokeWidth * scale}
            strokeDasharray="5,5"
          />
        );

      case 'arrow': {
        const startX = startPoint.x * scale;
        const startY = startPoint.y * scale;
        const endX = endPoint.x * scale;
        const endY = endPoint.y * scale;

        // Calculate arrowhead
        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowLength = 15 * scale;
        const arrowAngle = Math.PI / 6;

        const arrow1X = endX - arrowLength * Math.cos(angle - arrowAngle);
        const arrow1Y = endY - arrowLength * Math.sin(angle - arrowAngle);
        const arrow2X = endX - arrowLength * Math.cos(angle + arrowAngle);
        const arrow2Y = endY - arrowLength * Math.sin(angle + arrowAngle);

        return (
          <g>
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={strokeStyle}
              strokeWidth={strokeWidth * scale}
              strokeDasharray="5,5"
            />
            <polygon
              points={`${endX},${endY} ${arrow1X},${arrow1Y} ${arrow2X},${arrow2Y}`}
              fill={strokeStyle}
              stroke={strokeStyle}
              strokeWidth={1}
            />
          </g>
        );
      }

      default:
        return null;
    }
  };

  return (
    <svg
      className={cn('absolute inset-0 pointer-events-none', className)}
      style={{ overflow: 'visible' }}
    >
      {renderShape()}
    </svg>
  );
}

/**
 * Props for ShapeResizer component
 */
export interface ShapeResizerProps {
  /** The annotation being resized */
  annotation: ShapeAnnotation | LineAnnotation | ArrowAnnotation;
  /** Scale factor */
  scale: number;
  /** Callback when resize starts */
  onResizeStart?: (handle: HandlePosition) => void;
  /** Callback when resize is in progress */
  onResize?: (newRect: Rect, handle: HandlePosition) => void;
  /** Callback when resize ends */
  onResizeEnd?: (newRect: Rect) => void;
  /** Callback when shape is moved */
  onMove?: (newRect: Rect) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Handle size in pixels
 */
const HANDLE_SIZE = 8;

/**
 * ShapeResizer component
 * Provides resize handles for selected shapes
 */
export function ShapeResizer({
  annotation,
  scale,
  onResizeStart,
  onResize,
  onResizeEnd,
  onMove,
  className,
}: ShapeResizerProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [activeHandle, setActiveHandle] = React.useState<HandlePosition | null>(null);
  const [dragStart, setDragStart] = React.useState<Point | null>(null);
  const [originalRect, setOriginalRect] = React.useState<Rect | null>(null);

  const { rect } = annotation;
  const x = rect.x * scale;
  const y = rect.y * scale;
  const width = rect.width * scale;
  const height = rect.height * scale;

  // Calculate handle positions
  const handles: { position: HandlePosition; x: number; y: number; cursor: string }[] = [
    { position: 'top-left', x: x - HANDLE_SIZE / 2, y: y - HANDLE_SIZE / 2, cursor: 'nwse-resize' },
    { position: 'top', x: x + width / 2 - HANDLE_SIZE / 2, y: y - HANDLE_SIZE / 2, cursor: 'ns-resize' },
    { position: 'top-right', x: x + width - HANDLE_SIZE / 2, y: y - HANDLE_SIZE / 2, cursor: 'nesw-resize' },
    { position: 'right', x: x + width - HANDLE_SIZE / 2, y: y + height / 2 - HANDLE_SIZE / 2, cursor: 'ew-resize' },
    { position: 'bottom-right', x: x + width - HANDLE_SIZE / 2, y: y + height - HANDLE_SIZE / 2, cursor: 'nwse-resize' },
    { position: 'bottom', x: x + width / 2 - HANDLE_SIZE / 2, y: y + height - HANDLE_SIZE / 2, cursor: 'ns-resize' },
    { position: 'bottom-left', x: x - HANDLE_SIZE / 2, y: y + height - HANDLE_SIZE / 2, cursor: 'nesw-resize' },
    { position: 'left', x: x - HANDLE_SIZE / 2, y: y + height / 2 - HANDLE_SIZE / 2, cursor: 'ew-resize' },
  ];

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent, handle: HandlePosition | 'move') => {
      e.stopPropagation();
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setOriginalRect({ ...rect });

      if (handle !== 'move') {
        setActiveHandle(handle);
        onResizeStart?.(handle);
      } else {
        setActiveHandle(null);
      }
    },
    [rect, onResizeStart]
  );

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStart || !originalRect) return;

      const deltaX = (e.clientX - dragStart.x) / scale;
      const deltaY = (e.clientY - dragStart.y) / scale;

      let newRect: Rect;

      if (activeHandle === null) {
        // Moving the shape
        newRect = {
          x: originalRect.x + deltaX,
          y: originalRect.y + deltaY,
          width: originalRect.width,
          height: originalRect.height,
        };
        onMove?.(newRect);
      } else {
        // Resizing
        newRect = { ...originalRect };

        switch (activeHandle) {
          case 'top-left':
            newRect.x = originalRect.x + deltaX;
            newRect.y = originalRect.y + deltaY;
            newRect.width = originalRect.width - deltaX;
            newRect.height = originalRect.height - deltaY;
            break;
          case 'top':
            newRect.y = originalRect.y + deltaY;
            newRect.height = originalRect.height - deltaY;
            break;
          case 'top-right':
            newRect.y = originalRect.y + deltaY;
            newRect.width = originalRect.width + deltaX;
            newRect.height = originalRect.height - deltaY;
            break;
          case 'right':
            newRect.width = originalRect.width + deltaX;
            break;
          case 'bottom-right':
            newRect.width = originalRect.width + deltaX;
            newRect.height = originalRect.height + deltaY;
            break;
          case 'bottom':
            newRect.height = originalRect.height + deltaY;
            break;
          case 'bottom-left':
            newRect.x = originalRect.x + deltaX;
            newRect.width = originalRect.width - deltaX;
            newRect.height = originalRect.height + deltaY;
            break;
          case 'left':
            newRect.x = originalRect.x + deltaX;
            newRect.width = originalRect.width - deltaX;
            break;
        }

        // Ensure minimum size
        if (newRect.width < 10) {
          newRect.width = 10;
        }
        if (newRect.height < 10) {
          newRect.height = 10;
        }

        onResize?.(newRect, activeHandle);
      }
    },
    [isDragging, dragStart, originalRect, activeHandle, scale, onResize, onMove]
  );

  const handleMouseUp = React.useCallback(() => {
    if (isDragging && originalRect) {
      // Get the final rect from the store or calculate it
      onResizeEnd?.(rect);
    }
    setIsDragging(false);
    setActiveHandle(null);
    setDragStart(null);
    setOriginalRect(null);
  }, [isDragging, originalRect, rect, onResizeEnd]);

  // Add global mouse listeners when dragging
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className={cn('absolute pointer-events-none', className)}>
      {/* Selection border */}
      <div
        className="absolute border-2 border-primary border-dashed pointer-events-auto cursor-move"
        style={{
          left: x,
          top: y,
          width,
          height,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      />

      {/* Resize handles */}
      {handles.map((handle) => (
        <div
          key={handle.position}
          className="absolute bg-white border-2 border-primary pointer-events-auto"
          style={{
            left: handle.x,
            top: handle.y,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            cursor: handle.cursor,
          }}
          onMouseDown={(e) => handleMouseDown(e, handle.position)}
        />
      ))}
    </div>
  );
}

/**
 * Props for ShapePreview component
 */
export interface ShapePreviewProps {
  /** Type of shape */
  shapeType: ShapeType;
  /** Size of the preview */
  size?: number;
  /** Stroke color */
  strokeColor?: Color;
  /** Fill color */
  fillColor?: Color;
  /** Whether the shape is filled */
  filled?: boolean;
  /** Stroke width */
  strokeWidth?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ShapePreview component
 * Renders a preview of a shape for tool selection
 */
export function ShapePreview({
  shapeType,
  size = 24,
  strokeColor = { r: 0, g: 0, b: 0 },
  fillColor = { r: 1, g: 1, b: 1 },
  filled = false,
  strokeWidth = 2,
  className,
}: ShapePreviewProps) {
  const strokeStyle = colorToRgba(strokeColor, 1);
  const fillStyle = filled ? colorToRgba(fillColor, 1) : 'none';
  const padding = strokeWidth;

  const renderPreview = () => {
    switch (shapeType) {
      case 'rectangle':
        return (
          <rect
            x={padding}
            y={padding}
            width={size - padding * 2}
            height={size - padding * 2}
            stroke={strokeStyle}
            strokeWidth={strokeWidth}
            fill={fillStyle}
          />
        );

      case 'circle': {
        const radius = (size - padding * 2) / 2;
        return (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeStyle}
            strokeWidth={strokeWidth}
            fill={fillStyle}
          />
        );
      }

      case 'ellipse':
        return (
          <ellipse
            cx={size / 2}
            cy={size / 2}
            rx={(size - padding * 2) / 2}
            ry={(size - padding * 2) / 3}
            stroke={strokeStyle}
            strokeWidth={strokeWidth}
            fill={fillStyle}
          />
        );

      case 'line':
        return (
          <line
            x1={padding}
            y1={size - padding}
            x2={size - padding}
            y2={padding}
            stroke={strokeStyle}
            strokeWidth={strokeWidth}
          />
        );

      case 'arrow': {
        const arrowSize = 6;
        const endX = size - padding;
        const endY = padding;
        const startX = padding;
        const startY = size - padding;
        const angle = Math.atan2(endY - startY, endX - startX);

        const arrow1X = endX - arrowSize * Math.cos(angle - Math.PI / 6);
        const arrow1Y = endY - arrowSize * Math.sin(angle - Math.PI / 6);
        const arrow2X = endX - arrowSize * Math.cos(angle + Math.PI / 6);
        const arrow2Y = endY - arrowSize * Math.sin(angle + Math.PI / 6);

        return (
          <g>
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={strokeStyle}
              strokeWidth={strokeWidth}
            />
            <polygon
              points={`${endX},${endY} ${arrow1X},${arrow1Y} ${arrow2X},${arrow2Y}`}
              fill={strokeStyle}
            />
          </g>
        );
      }

      default:
        return null;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
    >
      {renderPreview()}
    </svg>
  );
}

ShapeDrawer.displayName = 'ShapeDrawer';
ShapeResizer.displayName = 'ShapeResizer';
ShapePreview.displayName = 'ShapePreview';

export default ShapeDrawer;
