import { ArrowLeft, Files, History, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export interface ToolHeaderProps {
  /** Short tool name shown in the breadcrumb. */
  title: string
}

/**
 * Shared navigation header for PDF tool pages.
 * Keeps the back action, product identity, and breadcrumb consistent.
 */
export function ToolHeader({ title }: ToolHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-surface-200 bg-card dark:border-surface-800 dark:bg-surface-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/" aria-label="Back to all PDF tools">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <nav
              aria-label="Breadcrumb"
              className="flex min-w-0 items-center gap-2 text-sm text-surface-500"
            >
              <Link
                to="/"
                className="shrink-0 transition-colors hover:text-surface-700 dark:hover:text-surface-300"
              >
                Home
              </Link>
              <span aria-hidden="true">/</span>
              <span
                className="truncate font-semibold text-surface-900 dark:text-white"
                aria-current="page"
              >
                {title}
              </span>
            </nav>
          </div>

          <nav aria-label="Workspace shortcuts" className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/files" aria-label="Library" className="gap-2">
                <Files className="h-4 w-4" />
                <span className="hidden lg:inline">Library</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/history" aria-label="History" className="gap-2">
                <History className="h-4 w-4" />
                <span className="hidden lg:inline">History</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/settings" aria-label="Settings" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden lg:inline">Settings</span>
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  )
}
