/**
 * BatchPanel - Sidebar panel for displaying and managing the batch queue
 * Shows all operations with controls for queue management
 */

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Layers,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BatchOperationItem } from './BatchOperationItem';
import { cn } from '@/lib/utils';
import {
  useBatchStore,
  selectQueueStats,
  selectIsQueueProcessing,
} from '@/store/batch-store';

/**
 * Props for BatchPanel
 */
export interface BatchPanelProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show as collapsed sidebar */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Callback when panel collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
}

/**
 * Batch operations panel component
 * Displays the queue with drag-to-reorder and control buttons
 */
export function BatchPanel({
  className,
  collapsible = true,
  defaultCollapsed = false,
  onCollapseChange,
}: BatchPanelProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const queue = useBatchStore((state) => state.queue);
  const queueStatus = useBatchStore((state) => state.queueStatus);
  const overallProgress = useBatchStore((state) => state.overallProgress);
  const stats = useBatchStore(selectQueueStats);
  const isProcessing = useBatchStore(selectIsQueueProcessing);

  const {
    removeFromQueue,
    clearQueue,
    clearCompleted,
    startQueue,
    pauseQueue,
    resumeQueue,
    cancelOperation,
    retryOperation,
    reorderQueue,
  } = useBatchStore();

  // DnD Kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Handle drag end for reordering
   */
  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = queue.findIndex((op) => op.id === active.id);
        const newIndex = queue.findIndex((op) => op.id === over.id);
        reorderQueue(oldIndex, newIndex);
      }
    },
    [queue, reorderQueue]
  );

  /**
   * Toggle collapsed state
   */
  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const newState = !prev;
      onCollapseChange?.(newState);
      return newState;
    });
  }, [onCollapseChange]);

  /**
   * Handle start/pause toggle
   */
  const handleToggleProcessing = React.useCallback(() => {
    if (queueStatus === 'processing') {
      pauseQueue();
    } else if (queueStatus === 'paused') {
      resumeQueue();
    } else {
      startQueue();
    }
  }, [queueStatus, pauseQueue, resumeQueue, startQueue]);

  // Collapsed view
  if (collapsible && collapsed) {
    return (
      <div
        className={cn(
          'flex flex-col items-center gap-2 p-2 bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700',
          className
        )}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapsed}
                className="relative"
              >
                <Layers className="h-5 w-5" />
                {queue.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary-500 text-[10px] font-medium text-white flex items-center justify-center">
                    {queue.length}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Batch Queue ({queue.length})</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {isProcessing && (
          <div className="w-1 h-16 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
            <div
              className="w-full bg-primary-500 transition-all duration-300"
              style={{ height: `${overallProgress}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col w-80 bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary-500" />
          <h2 className="font-semibold text-surface-900 dark:text-white">
            Batch Queue
          </h2>
          {queue.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 rounded-full">
              {queue.length}
            </span>
          )}
        </div>

        {collapsible && (
          <Button variant="ghost" size="icon" onClick={toggleCollapsed}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Overall Progress */}
      {(isProcessing || queueStatus === 'paused') && queue.length > 0 && (
        <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-surface-600 dark:text-surface-400">
              {queueStatus === 'paused' ? 'Paused' : 'Processing queue...'}
            </span>
            <span className="font-medium text-surface-900 dark:text-white">
              {stats.completed + stats.failed}/{stats.total}
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
      )}

      {/* Queue Statistics */}
      {queue.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 text-xs border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
          {stats.pending > 0 && (
            <span className="text-surface-500 dark:text-surface-400">
              {stats.pending} pending
            </span>
          )}
          {stats.processing > 0 && (
            <span className="text-blue-500">{stats.processing} processing</span>
          )}
          {stats.completed > 0 && (
            <span className="text-green-500">{stats.completed} completed</span>
          )}
          {stats.failed > 0 && (
            <span className="text-red-500">{stats.failed} failed</span>
          )}
        </div>
      )}

      {/* Control Buttons */}
      {queue.length > 0 && (
        <div className="flex items-center gap-2 p-3 border-b border-surface-200 dark:border-surface-700">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={handleToggleProcessing}
                  disabled={stats.pending === 0 && queueStatus !== 'paused'}
                  className="flex-1"
                >
                  {queueStatus === 'processing' ? (
                    <>
                      <Pause className="h-4 w-4 mr-1.5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1.5" />
                      {queueStatus === 'paused' ? 'Resume' : 'Start All'}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {queueStatus === 'processing'
                  ? 'Pause queue processing'
                  : 'Start processing queue'}
              </TooltipContent>
            </Tooltip>

            {stats.completed > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={clearCompleted}>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Clear Done
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear completed operations</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearQueue}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear all operations</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto p-3">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Layers className="h-12 w-12 text-surface-300 dark:text-surface-600 mb-3" />
            <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
              No operations in queue
            </p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
              Add operations from the tools panel
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={queue.map((op) => op.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {queue.map((operation) => (
                  <BatchOperationItem
                    key={operation.id}
                    operation={operation}
                    onRemove={removeFromQueue}
                    onRetry={retryOperation}
                    onCancel={cancelOperation}
                    dragEnabled={operation.status === 'pending'}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

/**
 * Compact batch queue indicator for header/toolbar
 */
export function BatchQueueIndicator({
  onClick,
  className,
}: {
  onClick?: () => void;
  className?: string;
}) {
  const queue = useBatchStore((state) => state.queue);
  const overallProgress = useBatchStore((state) => state.overallProgress);
  const isProcessing = useBatchStore(selectIsQueueProcessing);

  if (queue.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            className={cn('relative', className)}
          >
            <Layers className="h-4 w-4" />
            <span className="ml-1.5">{queue.length}</span>
            {isProcessing && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Batch Queue: {queue.length} operation{queue.length !== 1 ? 's' : ''}
          </p>
          {isProcessing && <p>{overallProgress}% complete</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
