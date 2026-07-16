/**
 * WatermarkPage - Page wrapper for the PDF watermark tools
 */

import { WatermarkPanel } from '@/components/tools/WatermarkPanel'

/**
 * Watermark tools page component
 * Provides the full page layout for adding watermarks to PDFs
 */
export function WatermarkPage() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Add Watermark
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Add text or image watermarks to your PDF documents.
            Customize position, opacity, size, and more.
            All processing happens locally in your browser.
          </p>
        </div>

        <WatermarkPanel />

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for Watermarking
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Text Watermarks:</strong> Use diagonal position for maximum visibility without blocking content.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Opacity:</strong> Keep opacity between 20-40% for a professional look that does not obstruct reading.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Image Watermarks:</strong> PNG images with transparent backgrounds work best.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Repeat Pattern:</strong> Enable for documents that may be cropped or scanned.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Your files never leave your device - all processing is done locally.
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}
