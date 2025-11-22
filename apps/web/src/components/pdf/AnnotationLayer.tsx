/**
 * AnnotationLayer Component
 * Canvas overlay for rendering and editing annotations on PDF pages
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  useAnnotationStore,
  type Annotation,
  type Point,
  type Rect,
  type AnnotationTool,
  type Color,
} from '@/store/annotation-store';

/**
 * Props for AnnotationLayer component
 */
export interface AnnotationLayerProps {
  /** Page number (1-indexed) */
  pageNum: number;
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Scale factor for the PDF view */
  scale: number;
  /** Page rotation in degrees */
  rotation?: 0 | 90 | 180 | 270;
  /** Whether annotations are editable */
  editable?: boolean;
  /** Callback when annotation is clicked */
  onAnnotationClick?: (annotation: Annotation) => void;
  /** Callback when annotation is double-clicked */
  onAnnotationDoubleClick?: (annotation: Annotation) => void;
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
  const a = color.a ?? opacity;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Selection handle positions
 */
const HANDLE_SIZE = 8;

/**
 * Draw selection handles around an annotation
 */
function drawSelectionHandles(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  scale: number
): void {
  const x = rect.x * scale;
  const y = rect.y * scale;
  const width = rect.width * scale;
  const height = rect.height * scale;
  const halfHandle = HANDLE_SIZE / 2;

  ctx.strokeStyle = '#0066cc';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0066cc';
  ctx.lineWidth = 1;

  // Corner handles
  const handles = [
    { x: x - halfHandle, y: y - halfHandle }, // Top-left
    { x: x + width - halfHandle, y: y - halfHandle }, // Top-right
    { x: x - halfHandle, y: y + height - halfHandle }, // Bottom-left
    { x: x + width - halfHandle, y: y + height - halfHandle }, // Bottom-right
    // Edge handles
    { x: x + width / 2 - halfHandle, y: y - halfHandle }, // Top
    { x: x + width / 2 - halfHandle, y: y + height - halfHandle }, // Bottom
    { x: x - halfHandle, y: y + height / 2 - halfHandle }, // Left
    { x: x + width - halfHandle, y: y + height / 2 - halfHandle }, // Right
  ];

  for (const handle of handles) {
    ctx.fillRect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE);
    ctx.strokeRect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE);
  }
}

/**
 * Draw a highlight annotation
 */
function drawHighlight(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation,
  scale: number
): void {
  const { rect, color, opacity } = annotation;

  ctx.fillStyle = colorToRgba(color, opacity * 0.35);
  ctx.fillRect(
    rect.x * scale,
    rect.y * scale,
    rect.width * scale,
    rect.height * scale
  );
}

/**
 * Draw an underline annotation
 */
function drawUnderline(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation,
  scale: number
): void {
  const { rect, color, opacity } = annotation;

  ctx.strokeStyle = colorToRgba(color, opacity);
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(rect.x * scale, (rect.y + rect.height) * scale);
  ctx.lineTo((rect.x + rect.width) * scale, (rect.y + rect.height) * scale);
  ctx.stroke();
}

/**
 * Draw a strikethrough annotation
 */
function drawStrikethrough(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation,
  scale: number
): void {
  const { rect, color, opacity } = annotation;
  const middleY = rect.y + rect.height / 2;

  ctx.strokeStyle = colorToRgba(color, opacity);
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(rect.x * scale, middleY * scale);
  ctx.lineTo((rect.x + rect.width) * scale, middleY * scale);
  ctx.stroke();
}

/**
 * Draw a text annotation
 */
function drawText(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation & { type: 'text' },
  scale: number
): void {
  const { rect, color, opacity, content, fontSize, fontFamily } = annotation;

  ctx.fillStyle = colorToRgba(color, opacity);
  ctx.font = `${fontSize * scale}px ${fontFamily}`;
  ctx.textBaseline = 'top';

  // Word wrap
  const words = content.split(' ');
  let line = '';
  let y = rect.y * scale;
  const maxWidth = rect.width * scale;
  const lineHeight = fontSize * scale * 1.2;

  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, rect.x * scale, y);
      line = word + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, rect.x * scale, y);
}

/**
 * Draw a note annotation
 */
function drawNote(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation & { type: 'note' },
  scale: number
): void {
  const { rect, color } = annotation;
  const size = 20 * scale;

  // Draw note icon background
  ctx.fillStyle = colorToRgba(color, 0.8);
  ctx.fillRect(rect.x * scale, rect.y * scale, size, size);

  // Draw note icon border
  ctx.strokeStyle = colorToRgba({ r: 0.7, g: 0.7, b: 0 }, 1);
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x * scale, rect.y * scale, size, size);

  // Draw 'N' indicator
  ctx.fillStyle = '#000000';
  ctx.font = `${12 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', rect.x * scale + size / 2, rect.y * scale + size / 2);
  ctx.textAlign = 'left';
}

/**
 * Draw a freehand annotation
 */
function drawFreehand(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation & { type: 'freehand' },
  scale: number
): void {
  const { paths, color, opacity, strokeWidth } = annotation;

  ctx.strokeStyle = colorToRgba(color, opacity);
  ctx.lineWidth = strokeWidth * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const path of paths) {
    if (path.length < 2) continue;

    ctx.beginPath();
    ctx.moveTo(path[0].x * scale, path[0].y * scale);

    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x * scale, path[i].y * scale);
    }

    ctx.stroke();
  }
}

/**
 * Draw a shape annotation
 */
function drawShape(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation & { type: 'rectangle' | 'circle' | 'ellipse' },
  scale: number
): void {
  const { rect, type, strokeColor, strokeWidth, filled, fillColor, opacity } = annotation;

  ctx.strokeStyle = colorToRgba(strokeColor, opacity);
  ctx.lineWidth = strokeWidth * scale;

  if (filled) {
    ctx.fillStyle = colorToRgba(fillColor, opacity);
  }

  const x = rect.x * scale;
  const y = rect.y * scale;
  const width = rect.width * scale;
  const height = rect.height * scale;

  if (type === 'rectangle') {
    if (filled) {
      ctx.fillRect(x, y, width, height);
    }
    ctx.strokeRect(x, y, width, height);
  } else if (type === 'circle' || type === 'ellipse') {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radiusX = width / 2;
    const radiusY = type === 'circle' ? Math.min(radiusX, height / 2) : height / 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    if (filled) {
      ctx.fill();
    }
    ctx.stroke();
  }
}

/**
 * Draw a line annotation
 */
function drawLine(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation & { type: 'line' },
  scale: number
): void {
  const { startPoint, endPoint, color, opacity, strokeWidth } = annotation;

  ctx.strokeStyle = colorToRgba(color, opacity);
  ctx.lineWidth = strokeWidth * scale;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(startPoint.x * scale, startPoint.y * scale);
  ctx.lineTo(endPoint.x * scale, endPoint.y * scale);
  ctx.stroke();
}

/**
 * Draw an arrow annotation
 */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation & { type: 'arrow' },
  scale: number
): void {
  const { startPoint, endPoint, color, opacity, strokeWidth } = annotation;

  ctx.strokeStyle = colorToRgba(color, opacity);
  ctx.fillStyle = colorToRgba(color, opacity);
  ctx.lineWidth = strokeWidth * scale;
  ctx.lineCap = 'round';

  const startX = startPoint.x * scale;
  const startY = startPoint.y * scale;
  const endX = endPoint.x * scale;
  const endY = endPoint.y * scale;

  // Draw main line
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Draw arrowhead
  const angle = Math.atan2(endY - startY, endX - startX);
  const arrowLength = 15 * scale;
  const arrowAngle = Math.PI / 6;

  const arrow1X = endX - arrowLength * Math.cos(angle - arrowAngle);
  const arrow1Y = endY - arrowLength * Math.sin(angle - arrowAngle);
  const arrow2X = endX - arrowLength * Math.cos(angle + arrowAngle);
  const arrow2Y = endY - arrowLength * Math.sin(angle + arrowAngle);

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(arrow1X, arrow1Y);
  ctx.lineTo(arrow2X, arrow2Y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a redaction annotation (preview)
 */
function drawRedaction(
  ctx: CanvasRenderingContext2D,
  annotation: Annotation & { type: 'redaction' },
  scale: number
): void {
  const { rect, applied } = annotation;

  const x = rect.x * scale;
  const y = rect.y * scale;
  const width = rect.width * scale;
  const height = rect.height * scale;

  if (applied) {
    // Solid black for applied redactions
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fillRect(x, y, width, height);
  } else {
    // Semi-transparent red for pending redactions
    ctx.fillStyle = 'rgba(200, 0, 0, 0.3)';
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = 'rgba(200, 0, 0, 1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Draw diagonal lines
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y + height);
    ctx.moveTo(x + width, y);
    ctx.lineTo(x, y + height);
    ctx.stroke();
  }
}

/**
 * AnnotationLayer component
 * Renders annotations on a canvas overlay for PDF pages
 */
export function AnnotationLayer({
  pageNum,
  width,
  height,
  scale,
  rotation = 0,
  editable = true,
  onAnnotationClick,
  onAnnotationDoubleClick,
  className,
}: AnnotationLayerProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const isDrawing = React.useRef(false);
  const lastPoint = React.useRef<Point | null>(null);

  const {
    annotations,
    selectedAnnotationId,
    currentTool,
    toolOptions,
    currentPath,
    isAnnotating,
    getAnnotationsForPage,
    selectAnnotation,
    addAnnotation,
    startPath,
    addToPath,
    endPath,
    clearPath,
  } = useAnnotationStore();

  // Get annotations for this page
  const pageAnnotations = React.useMemo(
    () => getAnnotationsForPage(pageNum),
    [getAnnotationsForPage, pageNum, annotations]
  );

  // Render annotations on canvas
  const renderAnnotations = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply rotation transform if needed
    if (rotation !== 0) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }

    // Draw each annotation
    for (const annotation of pageAnnotations) {
      switch (annotation.type) {
        case 'highlight':
          drawHighlight(ctx, annotation, scale);
          break;
        case 'underline':
          drawUnderline(ctx, annotation, scale);
          break;
        case 'strikethrough':
          drawStrikethrough(ctx, annotation, scale);
          break;
        case 'text':
          drawText(ctx, annotation, scale);
          break;
        case 'note':
          drawNote(ctx, annotation, scale);
          break;
        case 'freehand':
          drawFreehand(ctx, annotation, scale);
          break;
        case 'rectangle':
        case 'circle':
        case 'ellipse':
          drawShape(ctx, annotation, scale);
          break;
        case 'line':
          drawLine(ctx, annotation, scale);
          break;
        case 'arrow':
          drawArrow(ctx, annotation, scale);
          break;
        case 'redaction':
          drawRedaction(ctx, annotation, scale);
          break;
      }

      // Draw selection handles for selected annotation
      if (annotation.id === selectedAnnotationId && editable) {
        drawSelectionHandles(ctx, annotation.rect, scale);
      }
    }

    // Draw current path (for freehand drawing in progress)
    if (currentPath.length > 1) {
      ctx.strokeStyle = colorToRgba(toolOptions.color, toolOptions.opacity);
      ctx.lineWidth = toolOptions.strokeWidth * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(currentPath[0].x * scale, currentPath[0].y * scale);

      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x * scale, currentPath[i].y * scale);
      }

      ctx.stroke();
    }

    if (rotation !== 0) {
      ctx.restore();
    }
  }, [
    pageAnnotations,
    scale,
    rotation,
    selectedAnnotationId,
    editable,
    currentPath,
    toolOptions,
  ]);

  // Re-render when annotations or selection changes
  React.useEffect(() => {
    renderAnnotations();
  }, [renderAnnotations]);

  // Get point relative to canvas
  const getCanvasPoint = React.useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    },
    [scale]
  );

  // Find annotation at point
  const findAnnotationAtPoint = React.useCallback(
    (point: Point): Annotation | null => {
      // Search in reverse order (top annotations first)
      for (let i = pageAnnotations.length - 1; i >= 0; i--) {
        const annotation = pageAnnotations[i];
        const { rect } = annotation;

        if (
          point.x >= rect.x &&
          point.x <= rect.x + rect.width &&
          point.y >= rect.y &&
          point.y <= rect.y + rect.height
        ) {
          return annotation;
        }
      }
      return null;
    },
    [pageAnnotations]
  );

  // Handle mouse down
  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!editable) return;

      const point = getCanvasPoint(e);

      if (currentTool === 'select' || currentTool === 'hand') {
        const annotation = findAnnotationAtPoint(point);
        selectAnnotation(annotation?.id ?? null);

        if (annotation) {
          onAnnotationClick?.(annotation);
        }
      } else if (currentTool === 'freehand') {
        isDrawing.current = true;
        startPath(point);
        lastPoint.current = point;
      } else if (isAnnotating && currentTool) {
        isDrawing.current = true;
        lastPoint.current = point;
      }
    },
    [
      editable,
      currentTool,
      isAnnotating,
      getCanvasPoint,
      findAnnotationAtPoint,
      selectAnnotation,
      startPath,
      onAnnotationClick,
    ]
  );

  // Handle mouse move
  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!editable || !isDrawing.current) return;

      const point = getCanvasPoint(e);

      if (currentTool === 'freehand') {
        addToPath(point);
      }

      lastPoint.current = point;
    },
    [editable, currentTool, getCanvasPoint, addToPath]
  );

  // Handle mouse up
  const handleMouseUp = React.useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!editable || !isDrawing.current) return;

      const point = getCanvasPoint(e);

      if (currentTool === 'freehand') {
        endPath(pageNum);
      } else if (lastPoint.current && currentTool) {
        // Create shape annotation
        const startPoint = lastPoint.current;
        const rect: Rect = {
          x: Math.min(startPoint.x, point.x),
          y: Math.min(startPoint.y, point.y),
          width: Math.abs(point.x - startPoint.x),
          height: Math.abs(point.y - startPoint.y),
        };

        if (rect.width > 5 && rect.height > 5) {
          switch (currentTool) {
            case 'highlight':
              addAnnotation({
                type: 'highlight',
                pageNum,
                rect,
                color: toolOptions.color,
                opacity: 0.35,
                locked: false,
              });
              break;
            case 'underline':
              addAnnotation({
                type: 'underline',
                pageNum,
                rect,
                color: toolOptions.color,
                opacity: toolOptions.opacity,
                locked: false,
              });
              break;
            case 'strikethrough':
              addAnnotation({
                type: 'strikethrough',
                pageNum,
                rect,
                color: { r: 1, g: 0, b: 0 },
                opacity: toolOptions.opacity,
                locked: false,
              });
              break;
            case 'rectangle':
              addAnnotation({
                type: 'rectangle',
                pageNum,
                rect,
                color: toolOptions.color,
                opacity: toolOptions.opacity,
                strokeColor: toolOptions.strokeColor,
                strokeWidth: toolOptions.strokeWidth,
                filled: toolOptions.filled,
                fillColor: toolOptions.fillColor,
                locked: false,
              });
              break;
            case 'circle':
              addAnnotation({
                type: 'circle',
                pageNum,
                rect,
                color: toolOptions.color,
                opacity: toolOptions.opacity,
                strokeColor: toolOptions.strokeColor,
                strokeWidth: toolOptions.strokeWidth,
                filled: toolOptions.filled,
                fillColor: toolOptions.fillColor,
                locked: false,
              });
              break;
            case 'ellipse':
              addAnnotation({
                type: 'ellipse',
                pageNum,
                rect,
                color: toolOptions.color,
                opacity: toolOptions.opacity,
                strokeColor: toolOptions.strokeColor,
                strokeWidth: toolOptions.strokeWidth,
                filled: toolOptions.filled,
                fillColor: toolOptions.fillColor,
                locked: false,
              });
              break;
            case 'line':
              addAnnotation({
                type: 'line',
                pageNum,
                rect,
                color: toolOptions.color,
                opacity: toolOptions.opacity,
                strokeWidth: toolOptions.strokeWidth,
                startPoint,
                endPoint: point,
                locked: false,
              });
              break;
            case 'arrow':
              addAnnotation({
                type: 'arrow',
                pageNum,
                rect,
                color: toolOptions.color,
                opacity: toolOptions.opacity,
                strokeWidth: toolOptions.strokeWidth,
                startPoint,
                endPoint: point,
                locked: false,
              });
              break;
            case 'redact':
              addAnnotation({
                type: 'redaction',
                pageNum,
                rect,
                color: { r: 0, g: 0, b: 0 },
                opacity: 1,
                applied: false,
                locked: false,
              });
              break;
          }
        }
      }

      isDrawing.current = false;
      lastPoint.current = null;
      clearPath();
    },
    [
      editable,
      currentTool,
      pageNum,
      toolOptions,
      getCanvasPoint,
      addAnnotation,
      endPath,
      clearPath,
    ]
  );

  // Handle double click
  const handleDoubleClick = React.useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!editable) return;

      const point = getCanvasPoint(e);
      const annotation = findAnnotationAtPoint(point);

      if (annotation) {
        onAnnotationDoubleClick?.(annotation);
      } else if (currentTool === 'text' || currentTool === 'note') {
        // Create text/note annotation at click position
        const rect: Rect = {
          x: point.x,
          y: point.y,
          width: currentTool === 'note' ? 20 : 200,
          height: currentTool === 'note' ? 20 : 50,
        };

        if (currentTool === 'text') {
          addAnnotation({
            type: 'text',
            pageNum,
            rect,
            color: toolOptions.color,
            opacity: toolOptions.opacity,
            content: 'Double-click to edit',
            fontSize: toolOptions.fontSize,
            fontFamily: toolOptions.fontFamily,
            bold: false,
            italic: false,
            locked: false,
          });
        } else {
          addAnnotation({
            type: 'note',
            pageNum,
            rect,
            color: { r: 1, g: 1, b: 0 },
            opacity: 1,
            title: 'Note',
            content: '',
            isOpen: false,
            locked: false,
          });
        }
      }
    },
    [
      editable,
      currentTool,
      pageNum,
      toolOptions,
      getCanvasPoint,
      findAnnotationAtPoint,
      addAnnotation,
      onAnnotationDoubleClick,
    ]
  );

  // Get cursor style based on current tool
  const getCursor = (): string => {
    if (!editable) return 'default';

    switch (currentTool) {
      case 'select':
        return 'default';
      case 'hand':
        return 'grab';
      case 'freehand':
        return 'crosshair';
      case 'text':
      case 'note':
        return 'text';
      case 'highlight':
      case 'underline':
      case 'strikethrough':
      case 'rectangle':
      case 'circle':
      case 'ellipse':
      case 'line':
      case 'arrow':
      case 'redact':
        return 'crosshair';
      default:
        return 'default';
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={cn(
        'absolute inset-0 pointer-events-auto',
        className
      )}
      style={{ cursor: getCursor() }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (isDrawing.current) {
          handleMouseUp({} as React.MouseEvent<HTMLCanvasElement>);
        }
      }}
      onDoubleClick={handleDoubleClick}
    />
  );
}

AnnotationLayer.displayName = 'AnnotationLayer';

export default AnnotationLayer;
