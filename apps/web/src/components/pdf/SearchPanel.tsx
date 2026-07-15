/**
 * SearchPanel Component
 * Provides text search and replace functionality for PDF documents
 */

import * as React from "react";
import {
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Replace,
  CaseSensitive,
  WholeWord,
  Regex,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  SearchResult,
  SearchOptions,
  SearchState,
} from "@/hooks/useTextSearch";

/**
 * Props for the SearchPanel component
 */
export interface SearchPanelProps {
  /** Current search query */
  query: string;
  /** Set search query */
  onQueryChange: (query: string) => void;
  /** Current search options */
  options: SearchOptions;
  /** Set search options */
  onOptionsChange: (options: Partial<SearchOptions>) => void;
  /** Search results */
  results: SearchResult[];
  /** Current search state */
  searchState: SearchState;
  /** Error message if any */
  error: string | null;
  /** Current match index (0-indexed) */
  currentMatchIndex: number;
  /** Total number of matches */
  matchCount: number;
  /** Go to next match */
  onNextMatch: () => void;
  /** Go to previous match */
  onPrevMatch: () => void;
  /** Go to specific match */
  onGoToMatch: (index: number) => void;
  /** Clear search */
  onClear: () => void;
  /** Close the search panel */
  onClose?: () => void;
  /** Replace text value */
  replaceText?: string;
  /** Set replace text */
  onReplaceTextChange?: (text: string) => void;
  /** Replace current match */
  onReplaceCurrent?: () => Promise<boolean>;
  /** Replace all matches */
  onReplaceAll?: () => Promise<{ count: number; success: boolean }>;
  /** Whether replace is in progress */
  isReplacing?: boolean;
  /** Whether to show replace controls */
  showReplace?: boolean;
  /** Whether to show results list */
  showResultsList?: boolean;
  /** Maximum height for results list */
  resultsMaxHeight?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SearchPanel provides a comprehensive search and replace interface
 * for PDF documents with keyboard navigation support.
 *
 * @example
 * ```tsx
 * const search = useTextSearch({ pdfDocument });
 *
 * <SearchPanel
 *   query={search.query}
 *   onQueryChange={search.setQuery}
 *   options={search.options}
 *   onOptionsChange={search.setOptions}
 *   results={search.results}
 *   searchState={search.searchState}
 *   currentMatchIndex={search.currentMatchIndex}
 *   matchCount={search.matchCount}
 *   onNextMatch={search.nextMatch}
 *   onPrevMatch={search.prevMatch}
 *   onClear={search.clearSearch}
 * />
 * ```
 */
export function SearchPanel({
  query,
  onQueryChange,
  options,
  onOptionsChange,
  results,
  searchState,
  error,
  currentMatchIndex,
  matchCount,
  onNextMatch,
  onPrevMatch,
  onGoToMatch,
  onClear,
  onClose,
  replaceText = "",
  onReplaceTextChange,
  onReplaceCurrent,
  onReplaceAll,
  isReplacing = false,
  showReplace = false,
  showResultsList = false,
  resultsMaxHeight = 200,
  className,
}: SearchPanelProps) {
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const replaceInputRef = React.useRef<HTMLInputElement>(null);
  const [showReplacePanel, setShowReplacePanel] = React.useState(showReplace);

  /**
   * Focus search input on mount
   */
  React.useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  /**
   * Handle keyboard shortcuts
   */
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when search panel is focused
      const isSearchFocused =
        document.activeElement === searchInputRef.current ||
        document.activeElement === replaceInputRef.current;

      if (!isSearchFocused && e.key !== "f") return;

      // Ctrl/Cmd + F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Escape to close or clear
      if (e.key === "Escape") {
        e.preventDefault();
        if (query) {
          onClear();
        } else {
          onClose?.();
        }
        return;
      }

      // Enter or F3 for next match
      if (e.key === "Enter" || e.key === "F3") {
        e.preventDefault();
        if (e.shiftKey) {
          onPrevMatch();
        } else {
          onNextMatch();
        }
        return;
      }

      // Ctrl/Cmd + H to toggle replace panel
      if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault();
        setShowReplacePanel((prev) => !prev);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [query, onClear, onClose, onNextMatch, onPrevMatch]);

  /**
   * Handle search input change
   */
  const handleSearchChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onQueryChange(e.target.value);
    },
    [onQueryChange],
  );

  /**
   * Handle replace input change
   */
  const handleReplaceChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onReplaceTextChange?.(e.target.value);
    },
    [onReplaceTextChange],
  );

  /**
   * Handle replace current
   */
  const handleReplaceCurrent = React.useCallback(async () => {
    if (onReplaceCurrent) {
      await onReplaceCurrent();
    }
  }, [onReplaceCurrent]);

  /**
   * Handle replace all
   */
  const handleReplaceAll = React.useCallback(async () => {
    if (onReplaceAll) {
      await onReplaceAll();
    }
  }, [onReplaceAll]);

  /**
   * Render match count display
   */
  const renderMatchCount = () => {
    if (searchState === "searching") {
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Searching...
        </span>
      );
    }

    if (searchState === "error") {
      return (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          Error
        </span>
      );
    }

    if (!query) {
      return null;
    }

    if (matchCount === 0) {
      return <span className="text-xs text-muted-foreground">No results</span>;
    }

    return (
      <span className="text-xs text-muted-foreground">
        {currentMatchIndex + 1} of {matchCount}
      </span>
    );
  };

  /**
   * Highlight match text in context
   */
  const highlightContext = (context: string | undefined, matchText: string) => {
    if (!context) return null;

    const parts = context.split(
      new RegExp(`(${matchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
    );

    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === matchText.toLowerCase() ? (
            <mark
              key={i}
              className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded"
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </span>
    );
  };

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex flex-col gap-2 border-b bg-background p-3",
          className,
        )}
      >
        {/* Search Row */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search in document..."
              value={query}
              onChange={handleSearchChange}
              className="h-9 pl-9 pr-24"
              aria-label="Search text"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {renderMatchCount()}
            </div>
          </div>

          {/* Search Options */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={options.caseSensitive}
                  onPressedChange={(pressed: boolean) =>
                    onOptionsChange({ caseSensitive: pressed })
                  }
                  aria-label="Case sensitive"
                >
                  <CaseSensitive className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>Match case</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={options.wholeWord}
                  onPressedChange={(pressed: boolean) =>
                    onOptionsChange({ wholeWord: pressed })
                  }
                  aria-label="Whole word"
                >
                  <WholeWord className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>Match whole word</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={options.regex}
                  onPressedChange={(pressed: boolean) =>
                    onOptionsChange({ regex: pressed })
                  }
                  aria-label="Regular expression"
                >
                  <Regex className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>Use regular expression</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onPrevMatch}
                  disabled={matchCount === 0}
                  aria-label="Previous match"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Previous match (Shift+Enter)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onNextMatch}
                  disabled={matchCount === 0}
                  aria-label="Next match"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Next match (Enter)</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Toggle Replace */}
          {onReplaceTextChange && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showReplacePanel ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowReplacePanel((prev) => !prev)}
                  aria-label="Toggle replace"
                  aria-expanded={showReplacePanel}
                >
                  <Replace className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Replace (Ctrl+H)</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Close Button */}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Replace Row */}
        {showReplacePanel && onReplaceTextChange && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Replace className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={replaceInputRef}
                type="text"
                placeholder="Replace with..."
                value={replaceText}
                onChange={handleReplaceChange}
                className="h-9 pl-9"
                aria-label="Replace text"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReplaceCurrent}
              disabled={matchCount === 0 || isReplacing}
              className="shrink-0"
            >
              {isReplacing ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Replace
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReplaceAll}
              disabled={matchCount === 0 || isReplacing}
              className="shrink-0"
            >
              {isReplacing ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Replace All
            </Button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Results List */}
        {showResultsList && results.length > 0 && (
          <div
            className="overflow-auto border rounded-md"
            style={{ maxHeight: resultsMaxHeight }}
          >
            <ul className="divide-y" role="listbox" aria-label="Search results">
              {results.map((result, index) => (
                <li key={`${result.page}-${result.index}`}>
                  <button
                    type="button"
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors",
                      index === currentMatchIndex && "bg-muted",
                    )}
                    onClick={() => onGoToMatch(index)}
                    role="option"
                    aria-selected={index === currentMatchIndex}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-xs">
                        Page {result.page}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Match {index + 1}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-foreground/80 line-clamp-2">
                      {highlightContext(result.context, result.text)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

SearchPanel.displayName = "SearchPanel";

export default SearchPanel;
