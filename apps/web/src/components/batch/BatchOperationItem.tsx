/**
 * BatchOperationItem - Individual batch operation display component
 * Shows operation details, progress, and status with action buttons
 */

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FileText,
  Minimize2,
  FileOutput,
  Droplets,
  Scissors,
  ScanText,
  Lock,
  GripVertical,
  X,
  RotateCcw,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatFileSize, downloadBlob, arrayBufferToBlob } from '@/lib/utils';
import type {
  BatchOperation,
  BatchOperationType,
  BatchOperationStatus,
} from '@/store/batch-store';

/**
 * Get icon component for operation type
 */
function getOperationIcon(type: BatchOperationType) {
  const icons: Record<BatchOperationType, React.ReactNode> = {
    merge: <FileText className="h-4 w-4" />,
    compress: <Minimize2 className="h-4 w-4" />,
    convert: <FileOutput className="h-4 w-4" />,
    watermark: <Droplets className="h-4 w-4" />,
    split: <Scissors className="h-4 w-4" />,
    ocr: <ScanText className="h-4 w-4" />,
    security: <Lock className="h-4 w-4" />,
  };
  return icons[type];
}

/**
 * Get color classes for operation type
 */
function getOperationColor(type: BatchOperationType): string {
  const colors: Record<BatchOperationType, string> = {
    merge: 'text-blue-500 bg-blue-50 dark:bg-blue-950',
    compress: 'text-orange-500 bg-orange-50 dark:bg-orange-950',
    convert: 'text-purple-500 bg-purple-50 dark:bg-purple-950',
    watermark: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950',
    split: 'text-green-500 bg-green-50 dark:bg-green-950',
    ocr: 'text-amber-500 bg-amber-50 dark:bg-amber-950',
    security: 'text-red-500 bg-red-50 dark:bg-red-950',
  };
  return colors[type];
}

/**
 * Get status badge props
 */
function getStatusBadge(status: BatchOperationStatus): {
  icon: React.ReactNode;
  label: string;
  className: string;
} {
  const badges: Record<
    BatchOperationStatus,
    { icon: React.ReactNode; label: string; className: string }
  > = {
    pending: {
      icon: <Clock className="h-3 w-3" />,
      label: 'Pending',
      className: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
    },
    processing: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: 'Processing',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    },
    completed: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: 'Completed',
      className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    },
    failed: {
      icon: <XCircle className="h-3 w-3" />,
      label: 'Failed',
      className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    },
    cancelled: {
      icon: <AlertCircle className="h-3 w-3" />,
      label: 'Cancelled',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    },
  };
  return badges[status];
}

/**
 * Get operation type label
 */
function getTypeLabel(type: BatchOperationType): string {
  const labels: Record<BatchOperationType, string> = {
    merge: 'Merge PDFs',
    compress: 'Compress',
    convert: 'Convert',
    watermark: 'Add Watermark',
    split: 'Split PDF',
    ocr: 'OCR Extract',
    security: 'Add Security',
  };
  return labels[type];
}

/**
 * Props for BatchOperationItem
 */
export interface BatchOperationItemProps {
  /** The operation to display */
  operation: BatchOperation;
  /** Callback when remove is clicked */
  onRemove?: (id: string) => void;
  /** Callback when retry is clicked */
  onRetry?: (id: string) => void;
  /** Callback when cancel is clicked */
  onCancel?: (id: string) => void;
  /** Whether the item is being dragged */
  isDragging?: boolean;
  /** Whether drag is enabled */
  dragEnabled?: boolean;
  /** Show compact view */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Individual batch operation item component
 */
export function BatchOperationItem({
  operation,
  onRemove,
  onRetry,
  onCancel,
  dragEnabled = true,
  compact = false,
  className,
}: BatchOperationItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: operation.id,
    disabled: !dragEnabled || operation.status === 'processing',
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const statusBadge = getStatusBadge(operation.status);
  const totalSize = operation.files.reduce((sum, f) => sum + f.size, 0);

  /**
   * Handle download result
   */
  const handleDownload = React.useCallback(() => {
    if (operation.result?.data) {
      const blob = arrayBufferToBlob(operation.result.data, 'application/pdf');
      const filename = operation.result.filename ?? `${operation.type}_result.pdf`;
      downloadBlob(blob, filename);
    }
  }, [operation]);

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'flex items-center gap-2 p-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800',
          isDragging && 'shadow-lg opacity-90 z-10',
          className
        )}
      >
        {dragEnabled && operation.status === 'pending' && (
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing touch-none text-surface-400 hover:text-surface-600"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        <div className={cn('p-1.5 rounded', getOperationColor(operation.type))}>
          {getOperationIcon(operation.type)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-surface-900 dark:text-white truncate">
            {getTypeLabel(operation.type)}
          </p>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            {operation.files.length} file{operation.files.length !== 1 ? 's' : ''}
          </p>
        </div>

        {operation.status === 'processing' && (
          <div className="w-16">
            <Progress value={operation.progress} className="h-1" />
          </div>
        )}

        <div className={cn('px-1.5 py-0.5 rounded-full text-xs flex items-center gap-1', statusBadge.className)}>
          {statusBadge.icon}
        </div>

        {operation.status !== 'processing' && (
          <button
            type="button"
            onClick={() => onRemove?.(operation.id)}
            className="p-1 text-surface-400 hover:text-red-500 rounded"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex flex-col p-4 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800',
        isDragging && 'shadow-lg opacity-90 z-10',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {dragEnabled && operation.status === 'pending' && (
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing touch-none p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 mt-0.5"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}

        <div className={cn('p-2 rounded-lg', getOperationColor(operation.type))}>
          {getOperationIcon(operation.type)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-surface-900 dark:text-white">
              {getTypeLabel(operation.type)}
            </h4>
            <div
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
                statusBadge.className
              )}
            >
              {statusBadge.icon}
              <span>{statusBadge.label}</span>
            </div>
          </div>

          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
            {operation.files.length} file{operation.files.length !== 1 ? 's' : ''} ({formatFileSize(totalSize)})
          </p>

          {operation.files.length <= 3 && (
            <div className="mt-1 space-y-0.5">
              {operation.files.map((file) => (
                <p
                  key={file.id}
                  className="text-xs text-surface-400 dark:text-surface-500 truncate"
                >
                  {file.name}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      {operation.status === 'processing' && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-surface-500 dark:text-surface-400">
              {operation.progressStage ?? 'Processing...'}
            </span>
            <span className="font-medium text-surface-700 dark:text-surface-300">
              {Math.round(operation.progress)}%
            </span>
          </div>
          <Progress value={operation.progress} className="h-1.5" />
        </div>
      )}

      {/* Error message */}
      {operation.status === 'failed' && operation.result?.error && (
        <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400">
            {operation.result.error}
          </p>
        </div>
      )}

      {/* Result info */}
      {operation.status === 'completed' && operation.result && (
        <div className="mt-3 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <p className="text-xs text-green-600 dark:text-green-400">
              {operation.result.outputSize
                ? `Output: ${formatFileSize(operation.result.outputSize)}`
                : 'Completed successfully'}
            </p>
            {operation.result.processingTime && (
              <p className="text-xs text-green-500 dark:text-green-500">
                {(operation.result.processingTime / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        {operation.status === 'completed' && operation.result?.data && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="default" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download result</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {(operation.status === 'failed' || operation.status === 'cancelled') && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => onRetry?.(operation.id)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Retry
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry operation</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {operation.status === 'processing' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCancel?.(operation.id)}
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cancel operation</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {operation.status !== 'processing' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove?.(operation.id)}
                  className="text-surface-400 hover:text-red-500 ml-auto"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove from queue</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
