/**
 * HistoryPanel - Collapsible side panel showing operation history
 * Provides undo/redo controls and lists recent operations
 */

import * as React from 'react';
import {
  Undo2,
  Redo2,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Clock,
  History,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { OperationBadge } from './OperationBadge';
import { useOperationHistory } from '@/hooks/useOperationHistory';
import { cn, formatFileSize } from '@/lib/utils';
import type { HistoryEntry } from '@/store/history-store';

/**
 * Format a relative time string
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Props for HistoryEntryItem
 */
interface HistoryEntryItemProps {
  entry: HistoryEntry;
  isCurrentIndex: boolean;
  onRevert?: (entry: HistoryEntry) => void;
  onPreview?: (entry: HistoryEntry) => void;
}

/**
 * Single history entry item
 */
function HistoryEntryItem({
  entry,
  isCurrentIndex,
  onRevert,
  onPreview,
}: HistoryEntryItemProps) {
  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg border transition-colors',
        isCurrentIndex
          ? 'bg-primary-50 dark:bg-primary-950 border-primary-200 dark:border-primary-800'
          : 'bg-card dark:bg-surface-800 border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-750'
      )}
    >
      <OperationBadge type={entry.type} size="md" showTooltip />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
          {entry.description}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-surface-500 dark:text-surface-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(entry.timestamp)}
          </span>
          {entry.fileSize && (
            <span className="text-xs text-surface-400 dark:text-surface-500">
              {formatFileSize(entry.fileSize)}
            </span>
          )}
        </div>
        {entry.fileNames && entry.fileNames.length > 0 && (
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-1 truncate">
            {entry.fileNames.slice(0, 2).join(', ')}
            {entry.fileNames.length > 2 && ` +${entry.fileNames.length - 2} more`}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {entry.canUndo && onRevert && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onRevert(entry)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Revert to this state</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {onPreview && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onPreview(entry)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Preview</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

/**
 * Props for HistoryPanel
 */
export interface HistoryPanelProps {
  /** Whether panel is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
  /** Number of entries to show */
  maxEntries?: number;
  /** Show link to full history page */
  showViewAllLink?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when an entry is selected for preview */
  onPreviewEntry?: (entry: HistoryEntry) => void;
}

/**
 * HistoryPanel component
 * Shows recent operations with undo/redo controls
 */
export function HistoryPanel({
  collapsible = false,
  defaultCollapsed = false,
  onCollapseChange,
  maxEntries = 10,
  showViewAllLink = true,
  className,
  onPreviewEntry,
}: HistoryPanelProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const {
    history,
    currentIndex,
    canUndo,
    canRedo,
    historyCount,
    undoLastOperation,
    redoLastOperation,
    restoreHistoryEntry,
    clearHistory,
  } = useOperationHistory({
    showToasts: true,
    enableKeyboardShortcuts: false, // Let parent component handle this
  });

  const handleCollapseToggle = React.useCallback(() => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  }, [collapsed, onCollapseChange]);

  const handleRevert = React.useCallback(
    async (entry: HistoryEntry) => {
      await restoreHistoryEntry(entry);
    },
    [restoreHistoryEntry]
  );

  const recentEntries = React.useMemo(() => {
    return [...history].reverse().slice(0, maxEntries);
  }, [history, maxEntries]);

  // Collapsed view - just show icon buttons
  if (collapsible && collapsed) {
    return (
      <div
        className={cn(
          'flex flex-col items-center gap-2 p-2 border-l bg-surface-50 dark:bg-surface-900',
          className
        )}
      >
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCollapseToggle}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Expand history panel</p>
            </TooltipContent>
          </Tooltip>

          <div className="h-px w-8 bg-surface-200 dark:bg-surface-700" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => undoLastOperation()}
                disabled={!canUndo}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Undo (Ctrl+Z)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => redoLastOperation()}
                disabled={!canRedo}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Redo (Ctrl+Y)</p>
            </TooltipContent>
          </Tooltip>

          {historyCount > 0 && (
            <>
              <div className="h-px w-8 bg-surface-200 dark:bg-surface-700" />
              <span className="text-xs text-surface-500 dark:text-surface-400">
                {historyCount}
              </span>
            </>
          )}
        </TooltipProvider>
      </div>
    );
  }

  return (
    <Card className={cn('w-80 flex flex-col h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-primary-500" />
            History
          </CardTitle>
          {collapsible && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCollapseToggle}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CardDescription>
          Recent operations ({historyCount} total)
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Undo/Redo Controls */}
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => undoLastOperation()}
                  disabled={!canUndo}
                >
                  <Undo2 className="h-4 w-4 mr-1.5" />
                  Undo
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Undo last operation (Ctrl+Z)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => redoLastOperation()}
                  disabled={!canRedo}
                >
                  <Redo2 className="h-4 w-4 mr-1.5" />
                  Redo
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Redo operation (Ctrl+Y)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {recentEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-surface-500 dark:text-surface-400">
              <History className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No operations yet</p>
              <p className="text-xs">Your actions will appear here</p>
            </div>
          ) : (
            recentEntries.map((entry, index) => {
              const originalIndex = history.length - 1 - index;
              return (
                <HistoryEntryItem
                  key={entry.id}
                  entry={entry}
                  isCurrentIndex={originalIndex === currentIndex}
                  onRevert={entry.canUndo ? handleRevert : undefined}
                  onPreview={onPreviewEntry}
                />
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        {historyCount > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={clearHistory}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Clear history
            </Button>

            {showViewAllLink && historyCount > maxEntries && (
              <Button variant="link" size="sm" asChild>
                <Link to="/history">
                  View all ({historyCount})
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HistoryPanel;
