/**
 * MergePage - Page wrapper for the PDF merge tool
 */

import { MergePanel } from '@/components/tools/MergePanel'

/**
 * Merge PDF page component
 * Provides the full page layout for the merge tool
 */
export function MergePage() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Merge PDF Files
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Combine multiple PDF files into a single document. Drag and drop to reorder pages.
            All processing happens locally in your browser.
          </p>
        </div>

        <MergePanel />

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for merging PDFs
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Drag files in the list to change their order in the final merged document
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              You can add up to 100 PDF files at once
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Large files may take longer to process
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Your files never leave your device - all processing is done locally
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}
