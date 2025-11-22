/**
 * Citation Link Component
 * Displays a clickable reference to a specific PDF page
 */

import * as React from 'react'
import { FileText, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Citation } from '@pdflover/shared'

export interface CitationLinkProps {
  /** Citation data */
  citation: Citation
  /** Callback when citation is clicked */
  onNavigate?: (citation: Citation) => void
  /** Whether to show the excerpt in a tooltip */
  showExcerpt?: boolean
  /** Whether to highlight the source text after navigation */
  highlightOnNavigate?: boolean
  /** Display variant */
  variant?: 'inline' | 'block'
  /** Additional CSS classes */
  className?: string
}

/**
 * CitationLink component displays a reference to a PDF page.
 * Clicking navigates to the referenced page and optionally highlights the text.
 *
 * @example
 * ```tsx
 * <CitationLink
 *   citation={{
 *     documentId: 'doc-1',
 *     documentName: 'report.pdf',
 *     pageNumber: 5,
 *     excerpt: 'The total revenue increased by 15%...',
 *   }}
 *   onNavigate={(citation) => navigateToPage(citation.pageNumber)}
 * />
 * ```
 */
export function CitationLink({
  citation,
  onNavigate,
  showExcerpt = true,
  highlightOnNavigate = true,
  variant = 'inline',
  className,
}: CitationLinkProps) {
  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onNavigate?.(citation)
    },
    [citation, onNavigate]
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onNavigate?.(citation)
      }
    },
    [citation, onNavigate]
  )

  // Truncate excerpt for display
  const truncatedExcerpt = React.useMemo(() => {
    if (!citation.excerpt) return ''
    const maxLength = 150
    if (citation.excerpt.length <= maxLength) return citation.excerpt
    return `${citation.excerpt.slice(0, maxLength)}...`
  }, [citation.excerpt])

  const confidenceLabel = React.useMemo(() => {
    if (!citation.confidence) return null
    if (citation.confidence >= 0.9) return 'High confidence'
    if (citation.confidence >= 0.7) return 'Medium confidence'
    return 'Low confidence'
  }, [citation.confidence])

  if (variant === 'block') {
    return (
      <div
        className={cn(
          'group flex items-start gap-3 rounded-lg border border-muted bg-muted/30 p-3 transition-colors hover:bg-muted/50',
          'cursor-pointer',
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Go to page ${citation.pageNumber} of ${citation.documentName}`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {citation.documentName}
            </span>
            <span className="text-xs text-muted-foreground">
              Page {citation.pageNumber}
            </span>
            {confidenceLabel && (
              <span className="text-xs text-muted-foreground">
                ({confidenceLabel})
              </span>
            )}
          </div>
          {citation.excerpt && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              "{truncatedExcerpt}"
            </p>
          )}
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    )
  }

  // Inline variant
  const linkContent = (
    <Button
      variant="link"
      size="sm"
      className={cn(
        'inline-flex h-auto items-center gap-1 p-0 text-primary hover:underline',
        className
      )}
      onClick={handleClick}
      aria-label={`Go to page ${citation.pageNumber} of ${citation.documentName}`}
    >
      <FileText className="h-3 w-3" />
      <span className="text-xs">
        p.{citation.pageNumber}
      </span>
    </Button>
  )

  if (!showExcerpt || !citation.excerpt) {
    return linkContent
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {linkContent}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-sm"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium">
              <span>{citation.documentName}</span>
              <span className="text-muted-foreground">
                Page {citation.pageNumber}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              "{truncatedExcerpt}"
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export interface CitationListProps {
  /** List of citations to display */
  citations: Citation[]
  /** Callback when a citation is clicked */
  onNavigate?: (citation: Citation) => void
  /** Maximum citations to show before collapsing */
  maxVisible?: number
  /** Additional CSS classes */
  className?: string
}

/**
 * CitationList displays multiple citations with an expand/collapse option.
 */
export function CitationList({
  citations,
  onNavigate,
  maxVisible = 3,
  className,
}: CitationListProps) {
  const [expanded, setExpanded] = React.useState(false)

  if (citations.length === 0) return null

  const visibleCitations = expanded
    ? citations
    : citations.slice(0, maxVisible)
  const hiddenCount = citations.length - maxVisible

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <FileText className="h-3 w-3" />
        <span>Sources ({citations.length})</span>
      </div>
      <div className="space-y-2">
        {visibleCitations.map((citation, index) => (
          <CitationLink
            key={`${citation.documentId}-${citation.pageNumber}-${index}`}
            citation={citation}
            onNavigate={onNavigate}
            variant="block"
          />
        ))}
      </div>
      {hiddenCount > 0 && !expanded && (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(true)}
        >
          Show {hiddenCount} more source{hiddenCount > 1 ? 's' : ''}
        </Button>
      )}
      {expanded && citations.length > maxVisible && (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(false)}
        >
          Show less
        </Button>
      )}
    </div>
  )
}
