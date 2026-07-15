/**
 * HistoryPage - Full history view with search, filter, and bulk operations
 */

import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  History,
  Search,
  Filter,
  Trash2,
  Download,
  Undo2,
  Redo2,
  Calendar,
  FileText,
  Clock,
  X,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { OperationBadge, getOperationColors } from '@/components/history/OperationBadge';
import { useOperationHistory } from '@/hooks/useOperationHistory';
import { useHistoryStore, getOperationTypeLabel } from '@/store/history-store';
import { cn, formatFileSize } from '@/lib/utils';
import type { HistoryEntry, OperationType } from '@/store/history-store';

/**
 * All operation types for filtering
 */
const ALL_OPERATION_TYPES: OperationType[] = [
  'merge',
  'split',
  'compress',
  'convert',
  'watermark',
  'security',
  'rotate',
  'crop',
  'resize',
  'reorder',
  'delete_pages',
  'extract_images',
  'extract_text',
  'ocr',
  'signature',
  'annotation',
  'edit',
  'other',
];

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) {
    return `Today at ${timeStr}`;
  } else if (isYesterday) {
    return `Yesterday at ${timeStr}`;
  } else {
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    }) + ` at ${timeStr}`;
  }
}

/**
 * Group entries by date
 */
function groupByDate(entries: HistoryEntry[]): Map<string, HistoryEntry[]> {
  const groups = new Map<string, HistoryEntry[]>();

  entries.forEach((entry) => {
    const dateKey = entry.timestamp.toDateString();
    const existing = groups.get(dateKey) ?? [];
    groups.set(dateKey, [...existing, entry]);
  });

  return groups;
}

/**
 * Get date group label
 */
function getDateGroupLabel(dateKey: string): string {
  const date = new Date(dateKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateKey === today.toDateString()) {
    return 'Today';
  } else if (dateKey === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Single history entry row
 */
function HistoryRow({
  entry,
  isSelected,
  onSelect,
  onRevert,
  currentIndex,
  entryIndex,
}: {
  entry: HistoryEntry;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onRevert?: (entry: HistoryEntry) => void;
  currentIndex: number;
  entryIndex: number;
}) {
  const colors = getOperationColors(entry.type);
  const isCurrent = entryIndex === currentIndex;

  return (
    <div
      className={cn(
        'group flex items-center gap-4 p-4 rounded-lg border transition-colors',
        isSelected
          ? 'bg-primary-50 dark:bg-primary-950 border-primary-300 dark:border-primary-700'
          : isCurrent
          ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
          : 'bg-card dark:bg-surface-800 border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-750'
      )}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onSelect(entry.id, e.target.checked)}
        className="h-4 w-4 rounded border-surface-300 dark:border-surface-600"
      />

      {/* Operation Badge */}
      <OperationBadge type={entry.type} size="md" showLabel showTooltip={false} />

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
          {entry.description}
        </p>
        {entry.fileNames && entry.fileNames.length > 0 && (
          <p className="text-xs text-surface-500 dark:text-surface-400 truncate mt-0.5">
            {entry.fileNames.join(', ')}
          </p>
        )}
      </div>

      {/* Metadata */}
      <div className="hidden sm:flex flex-col items-end gap-0.5">
        <span className="text-xs text-surface-500 dark:text-surface-400 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatTimestamp(entry.timestamp)}
        </span>
        {entry.fileSize && (
          <span className="text-xs text-surface-400 dark:text-surface-500">
            {formatFileSize(entry.fileSize)}
          </span>
        )}
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-2">
        {isCurrent && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
            Current
          </span>
        )}
        {entry.canUndo && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
            Undoable
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {entry.canUndo && onRevert && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onRevert(entry)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Revert to this state</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

/**
 * History page component
 */
export function HistoryPage() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedTypes, setSelectedTypes] = React.useState<OperationType[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [showClearDialog, setShowClearDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

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
    enableKeyboardShortcuts: true,
  });

  const removeEntry = useHistoryStore((state) => state.removeEntry);
  const clearRange = useHistoryStore((state) => state.clearRange);
  const clearOlderThan = useHistoryStore((state) => state.clearOlderThan);

  // Filter and search entries
  const filteredEntries = React.useMemo(() => {
    let entries = [...history].reverse();

    // Apply type filter
    if (selectedTypes.length > 0) {
      entries = entries.filter((e) => selectedTypes.includes(e.type));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.description.toLowerCase().includes(query) ||
          e.fileNames?.some((f) => f.toLowerCase().includes(query)) ||
          getOperationTypeLabel(e.type).toLowerCase().includes(query)
      );
    }

    return entries;
  }, [history, selectedTypes, searchQuery]);

  // Group filtered entries by date
  const groupedEntries = React.useMemo(() => {
    return groupByDate(filteredEntries);
  }, [filteredEntries]);

  // Selection handlers
  const handleSelect = React.useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = React.useCallback(() => {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map((e) => e.id)));
    }
  }, [filteredEntries, selectedIds.size]);

  // Delete selected entries
  const handleDeleteSelected = React.useCallback(() => {
    selectedIds.forEach((id) => removeEntry(id));
    setSelectedIds(new Set());
    setShowDeleteDialog(false);
  }, [selectedIds, removeEntry]);

  // Export history as JSON
  const handleExportHistory = React.useCallback(() => {
    const exportData = history.map((entry) => ({
      id: entry.id,
      type: entry.type,
      timestamp: entry.timestamp.toISOString(),
      description: entry.description,
      fileNames: entry.fileNames,
      fileSize: entry.fileSize,
      metadata: entry.metadata,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pdflover-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [history]);

  // Clear old entries
  const handleClearOlderThan = React.useCallback(
    (days: number) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      clearOlderThan(cutoff);
    },
    [clearOlderThan]
  );

  // Toggle type filter
  const handleTypeToggle = React.useCallback((type: OperationType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  }, []);

  const handleRevert = React.useCallback(
    async (entry: HistoryEntry) => {
      await restoreHistoryEntry(entry);
    },
    [restoreHistoryEntry]
  );

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            to="/"
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-surface-600 dark:text-surface-400" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <History className="h-7 w-7 text-primary-500" />
              Operation History
            </h1>
            <p className="text-surface-600 dark:text-surface-400 mt-1">
              View and manage your PDF operation history ({historyCount} operations)
            </p>
          </div>
        </div>

        {/* Actions Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Undo/Redo */}
              <div className="flex items-center gap-2">
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
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

              <div className="h-6 w-px bg-surface-200 dark:bg-surface-700" />

              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                <Input
                  type="text"
                  placeholder="Search operations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Type Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-1.5" />
                    Filter
                    {selectedTypes.length > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded">
                        {selectedTypes.length}
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4 ml-1.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_OPERATION_TYPES.map((type) => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={() => handleTypeToggle(type)}
                    >
                      <OperationBadge
                        type={type}
                        size="sm"
                        showLabel
                        showTooltip={false}
                        className="mr-2"
                      />
                    </DropdownMenuCheckboxItem>
                  ))}
                  {selectedTypes.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSelectedTypes([])}>
                        Clear filters
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex-1" />

              {/* Bulk Actions */}
              {selectedIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete ({selectedIds.size})
                </Button>
              )}

              {/* More Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    More
                    <ChevronDown className="h-4 w-4 ml-1.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportHistory}>
                    <Download className="h-4 w-4 mr-2" />
                    Export history
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleClearOlderThan(7)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Clear older than 7 days
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleClearOlderThan(30)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Clear older than 30 days
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowClearDialog(true)}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear all history
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* History List */}
        {filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <History className="h-16 w-16 text-surface-300 dark:text-surface-600 mb-4" />
              <h3 className="text-lg font-medium text-surface-900 dark:text-white mb-2">
                {historyCount === 0 ? 'No operations yet' : 'No matching operations'}
              </h3>
              <p className="text-surface-500 dark:text-surface-400 text-center max-w-md">
                {historyCount === 0
                  ? 'Your PDF operations will appear here. Try merging, splitting, or compressing a PDF to get started.'
                  : 'Try adjusting your search or filters to find what you\'re looking for.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Select All */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.size === filteredEntries.length && filteredEntries.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 rounded border-surface-300 dark:border-surface-600"
              />
              <span className="text-sm text-surface-600 dark:text-surface-400">
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : `Select all (${filteredEntries.length})`}
              </span>
            </div>

            {/* Grouped entries */}
            {Array.from(groupedEntries.entries()).map(([dateKey, entries]) => (
              <div key={dateKey}>
                <h3 className="text-sm font-medium text-surface-500 dark:text-surface-400 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {getDateGroupLabel(dateKey)}
                  <span className="text-xs">({entries.length})</span>
                </h3>
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const entryIndex = history.findIndex((e) => e.id === entry.id);
                    return (
                      <HistoryRow
                        key={entry.id}
                        entry={entry}
                        isSelected={selectedIds.has(entry.id)}
                        onSelect={handleSelect}
                        onRevert={entry.canUndo ? handleRevert : undefined}
                        currentIndex={currentIndex}
                        entryIndex={entryIndex}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clear All Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all history?</DialogTitle>
            <DialogDescription>
              This will permanently delete all {historyCount} operations from your history.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearHistory();
                setShowClearDialog(false);
              }}
            >
              Clear all history
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Selected Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected entries?</DialogTitle>
            <DialogDescription>
              This will permanently delete {selectedIds.size} selected operations from your history.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSelected}>
              Delete {selectedIds.size} entries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default HistoryPage;
