/**
 * ExtractTablesPage - Page wrapper for the PDF table extraction tool
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, Heart } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TableExtractionPanel } from '@/components/smart/TableExtractionPanel'

/**
 * Extract Tables from PDF page component
 * Provides the full page layout for the table extraction tool
 */
export function ExtractTablesPage() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <header className="bg-card dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 sticky top-0 z-10">
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
              <span className="text-surface-900 dark:text-white font-medium">Extract Tables</span>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Extract Tables from PDF
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Detect and extract tables from your PDF documents. Export to CSV, Excel, or JSON.
            All processing happens locally in your browser for maximum privacy.
          </p>
        </div>

        <TableExtractionPanel />

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for extracting tables
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Tables with clear borders and consistent formatting work best
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Adjust the confidence slider if tables are being missed or false positives detected
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Click cells in expanded view to edit values before exporting
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Use Excel format for preserving multiple tables as separate worksheets
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Copy tables directly to clipboard for pasting into spreadsheet applications
            </li>
          </ul>
        </div>

        {/* Export Formats Section */}
        <div className="mt-4 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Export Formats
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <p className="font-medium text-surface-900 dark:text-white mb-1">CSV</p>
              <p className="text-xs text-surface-500">
                Comma-separated values, compatible with Excel, Google Sheets, and data tools
              </p>
            </div>
            <div className="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <p className="font-medium text-surface-900 dark:text-white mb-1">Excel (XLSX)</p>
              <p className="text-xs text-surface-500">
                Native Excel format with multiple worksheets and formatting support
              </p>
            </div>
            <div className="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <p className="font-medium text-surface-900 dark:text-white mb-1">JSON</p>
              <p className="text-xs text-surface-500">
                Structured data format for developers and API integration
              </p>
            </div>
          </div>
        </div>

        {/* Limitations Section */}
        <div className="mt-4 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Known Limitations
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-amber-500">!</span>
              Tables without visible borders may require lower confidence settings
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500">!</span>
              Scanned PDFs require OCR processing first (use the OCR tool)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500">!</span>
              Complex nested tables may be extracted as separate tables
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500">!</span>
              Merged cells are detected but may require manual adjustment
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}
