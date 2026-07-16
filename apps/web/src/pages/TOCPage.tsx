/**
 * TOCPage - Page wrapper for the Table of Contents generator tool
 */

import * as React from 'react'
import { FileText, Eye, EyeOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TOCPanel } from '@/components/smart/TOCPanel'
import type { TOCEntry } from '@pdflover/pdf-core'

/**
 * Simple PDF preview component
 */
interface PDFPreviewProps {
  data: ArrayBuffer | null
  className?: string
}

function PDFPreview({ data, className }: PDFPreviewProps) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (data) {
      const blob = new Blob([data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setObjectUrl(null)
  }, [data])

  if (!objectUrl) {
    return (
      <div className={`flex items-center justify-center bg-surface-100 dark:bg-surface-800 rounded-lg ${className}`}>
        <div className="text-center text-surface-500">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">PDF preview will appear here</p>
          <p className="text-xs mt-1">after generating TOC</p>
        </div>
      </div>
    )
  }

  return (
    <iframe
      src={objectUrl}
      className={`w-full rounded-lg border border-surface-200 dark:border-surface-700 ${className}`}
      title="PDF Preview"
    />
  )
}

/**
 * TOC Page component
 * Provides the full page layout for the TOC generator tool
 */
export function TOCPage() {
  const [generatedPDF, setGeneratedPDF] = React.useState<ArrayBuffer | null>(null)
  const [tocEntries, setTocEntries] = React.useState<TOCEntry[]>([])
  const [showPreview, setShowPreview] = React.useState(true)

  const handleTOCGenerated = React.useCallback((entries: TOCEntry[]) => {
    setTocEntries(entries)
  }, [])

  const handlePDFReady = React.useCallback((data: ArrayBuffer, entries: TOCEntry[]) => {
    setGeneratedPDF(data)
    setTocEntries(entries)
  }, [])

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
              Generate Table of Contents
            </h1>
            <p className="text-surface-600 dark:text-surface-400">
              Automatically detect headings in your PDF and create a clickable Table of Contents.
              Edit, reorder, and customize entries before generating. All processing happens locally.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="hidden shrink-0 lg:flex"
          >
            {showPreview ? (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                Hide Preview
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Show Preview
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: TOC Panel */}
          <div className="space-y-6">
            <TOCPanel
              onTOCGenerated={handleTOCGenerated}
              onPDFReady={handlePDFReady}
            />

            {/* TOC Summary */}
            {tocEntries.length > 0 && (
              <div className="p-4 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
                <h3 className="text-sm font-medium text-surface-900 dark:text-white mb-3">
                  TOC Summary
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-surface-500">Total Entries:</span>
                    <span className="ml-2 font-medium">{tocEntries.length}</span>
                  </div>
                  <div>
                    <span className="text-surface-500">Pages Covered:</span>
                    <span className="ml-2 font-medium">
                      {new Set(tocEntries.map((e) => e.page)).size}
                    </span>
                  </div>
                  <div>
                    <span className="text-surface-500">H1 Entries:</span>
                    <span className="ml-2 font-medium">
                      {tocEntries.filter((e) => e.level === 1).length}
                    </span>
                  </div>
                  <div>
                    <span className="text-surface-500">H2+ Entries:</span>
                    <span className="ml-2 font-medium">
                      {tocEntries.filter((e) => e.level > 1).length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Preview */}
          {showPreview && (
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700">
                  <h3 className="text-sm font-medium text-surface-900 dark:text-white">
                    PDF Preview
                  </h3>
                </div>
                <PDFPreview
                  data={generatedPDF}
                  className="h-[600px]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for generating a Table of Contents
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <span>
                <strong>Auto-detection</strong> works best with PDFs that have consistent heading styles
                (larger fonts or bold text for headings)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <span>
                <strong>Adjust the minimum font size</strong> if too many or too few headings are detected
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <span>
                <strong>Drag entries</strong> to reorder them in the TOC
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <span>
                <strong>Click on entry text</strong> to edit the title that will appear in the TOC
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <span>
                <strong>Use level arrows</strong> to promote (decrease level) or demote (increase level)
                entries for proper nesting
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <span>
                <strong>Add entries manually</strong> if the auto-detection misses important sections
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <span>
                <strong>Enable clickable links</strong> to create a navigable TOC (recommended for digital PDFs)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Your files never leave your device - all processing is done locally in your browser
            </li>
          </ul>
        </div>

        {/* How It Works Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
              <span className="text-lg font-bold text-primary-600 dark:text-primary-400">1</span>
            </div>
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-2">
              Upload Your PDF
            </h3>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Drag and drop or click to upload your PDF document. Supports any standard PDF file.
            </p>
          </div>

          <div className="p-5 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
              <span className="text-lg font-bold text-primary-600 dark:text-primary-400">2</span>
            </div>
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-2">
              Detect & Edit
            </h3>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Click "Auto-Detect" to find headings, then edit, reorder, or add entries as needed.
            </p>
          </div>

          <div className="p-5 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
              <span className="text-lg font-bold text-primary-600 dark:text-primary-400">3</span>
            </div>
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-2">
              Generate & Download
            </h3>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Click generate to create your TOC and download the new PDF with the TOC at the beginning.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
