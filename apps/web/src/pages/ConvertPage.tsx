/**
 * ConvertPage - Page wrapper for the PDF conversion tool
 */

import { ConvertPanel } from '@/components/tools/ConvertPanel'

/**
 * Convert PDF page component
 * Provides the full page layout for the conversion tool
 */
export function ConvertPage() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Convert PDF Files
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Convert PDFs to images or text, or create PDFs from images.
            All processing happens locally in your browser.
          </p>
        </div>

        <ConvertPanel />

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for PDF conversion
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              PNG format preserves transparency, JPG offers smaller file sizes
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Higher DPI settings produce larger, higher-quality images
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Text extraction works best on text-based PDFs, not scanned documents
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              When creating PDFs from images, the image order determines page order
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}
