/**
 * CompressPage - Page wrapper for the PDF compression tool
 */

import { CompressPanel } from '@/components/tools/CompressPanel'

/**
 * Compress PDF page component
 * Provides the full page layout for the compression tool
 */
export function CompressPage() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Compress PDF Files
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Reduce PDF file size while maintaining quality.
            Perfect for email attachments and web uploads.
          </p>
        </div>

        <CompressPanel />

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for PDF compression
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              PDFs with many images will typically compress more than text-only documents
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Higher compression levels may reduce image quality
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Already optimized PDFs may not compress further
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Medium compression usually offers the best balance of size and quality
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}
