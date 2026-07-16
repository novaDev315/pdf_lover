/**
 * ExtractImagesPage - Page wrapper for the PDF image extraction tool
 */

import { ExtractImagesPanel } from '@/components/tools/ExtractImagesPanel'

/**
 * Extract Images from PDF page component
 * Provides the full page layout for the image extraction tool
 */
export function ExtractImagesPage() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Extract Images from PDF
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Extract all images embedded in your PDF documents.
            All processing happens locally in your browser for maximum privacy.
          </p>
        </div>

        <ExtractImagesPanel />

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for extracting images
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Use size filters to exclude small icons and decorations
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Choose PNG format for images with transparency or sharp edges
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              JPEG format is best for photographs with smaller file sizes
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              WebP offers the best compression with good quality
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Select specific images or download all as a ZIP archive
            </li>
          </ul>
        </div>

        {/* Supported Formats Section */}
        <div className="mt-4 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Supported Image Types
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <p className="font-medium text-surface-900 dark:text-white">JPEG</p>
              <p className="text-xs text-surface-500">DCTDecode</p>
            </div>
            <div className="text-center p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <p className="font-medium text-surface-900 dark:text-white">PNG</p>
              <p className="text-xs text-surface-500">FlateDecode</p>
            </div>
            <div className="text-center p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <p className="font-medium text-surface-900 dark:text-white">JPEG2000</p>
              <p className="text-xs text-surface-500">JPXDecode</p>
            </div>
            <div className="text-center p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <p className="font-medium text-surface-900 dark:text-white">JBIG2</p>
              <p className="text-xs text-surface-500">JBIG2Decode</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
