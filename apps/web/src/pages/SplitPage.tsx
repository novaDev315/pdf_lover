/**
 * SplitPage - Page wrapper for the PDF split tool
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, Heart } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SplitPanel } from '@/components/tools/SplitPanel'

/**
 * Split PDF page component
 * Provides the full page layout for the split tool
 */
export function SplitPage() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <Heart className="h-6 w-6 text-primary-500" fill="currentColor" />
                <span className="text-lg font-bold text-surface-900 dark:text-white">
                  PDFLover
                </span>
              </div>
            </div>
            <nav className="flex items-center gap-2 text-sm text-surface-500">
              <Link to="/" className="hover:text-surface-700 dark:hover:text-surface-300">
                Home
              </Link>
              <span>/</span>
              <span className="text-surface-900 dark:text-white font-medium">Split PDF</span>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Split PDF Files
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Extract specific pages or split a PDF into multiple files.
            All processing happens locally in your browser.
          </p>
        </div>

        <SplitPanel />

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for splitting PDFs
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Use page ranges like &quot;1-5, 8, 10-12&quot; to extract specific pages
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Click individual page numbers to select them for extraction
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Use &quot;Every N Pages&quot; to split a document into equal parts
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Multiple files will be downloaded as a ZIP archive
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}
