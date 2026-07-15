import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export interface AppFooterProps {
  className?: string
}

/** Shared workspace footer used by the catalog and every PDF tool page. */
export function AppFooter({ className }: AppFooterProps) {
  const linkClassName =
    'rounded-sm transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:hover:text-primary-400 dark:focus-visible:ring-offset-surface-950'

  return (
    <footer
      className={cn(
        'border-t border-surface-200 bg-surface-50 px-4 py-6 dark:border-surface-800 dark:bg-surface-950 sm:px-6 lg:px-8',
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-surface-500 sm:flex-row sm:items-center sm:justify-between">
        <p>PDFLover · Privacy-first PDF workspace</p>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-4 gap-y-2"
        >
          <Link className={linkClassName} to="/#all-tools">
            All tools
          </Link>
          <Link className={linkClassName} to="/files">
            Library
          </Link>
          <Link className={linkClassName} to="/history">
            History
          </Link>
          <Link className={linkClassName} to="/settings">
            Settings
          </Link>
        </nav>
      </div>
    </footer>
  )
}
