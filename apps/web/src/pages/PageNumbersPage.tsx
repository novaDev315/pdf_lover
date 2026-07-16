/**
 * PageNumbersPage - Page wrapper for PDF page numbering and header/footer tools
 */

import { Hash, FileText } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageNumbersPanel } from '@/components/tools/PageNumbersPanel'
import { HeaderFooterPanel } from '@/components/tools/HeaderFooterPanel'

/**
 * Page Numbers and Header/Footer tools page component
 * Provides the full page layout for adding page numbers and headers/footers to PDFs
 */
export function PageNumbersPage() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Page Numbers, Headers & Footers
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Add page numbers, headers, footers, and Bates numbering to your PDF documents.
            Customize position, format, fonts, and more.
            All processing happens locally in your browser.
          </p>
        </div>

        {/* Tool Selection Tabs */}
        <Tabs defaultValue="page-numbers" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="page-numbers" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Page Numbers
            </TabsTrigger>
            <TabsTrigger value="header-footer" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Header & Footer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="page-numbers">
            <PageNumbersPanel />
          </TabsContent>

          <TabsContent value="header-footer">
            <HeaderFooterPanel />
          </TabsContent>
        </Tabs>

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for Page Elements
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Page Numbers:</strong> Use "X of Y" format for documents where total page count is important.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Bates Numbering:</strong> Common in legal proceedings. Use a consistent prefix like case numbers.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Headers:</strong> Great for document titles, company names, or classification labels.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Footers:</strong> Use placeholders like {'{page}'}, {'{total}'}, and {'{date}'} for dynamic content.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              <strong>Odd/Even Pages:</strong> Enable for book-style layouts with different left/right page headers.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Your files never leave your device - all processing is done locally.
            </li>
          </ul>
        </div>

        {/* Use Cases Section */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
            <h3 className="font-medium text-surface-900 dark:text-white mb-2">
              Legal Documents
            </h3>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Add Bates numbers for court filings and legal discovery.
              Each page gets a unique identifier for easy reference.
            </p>
          </div>
          <div className="p-4 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
            <h3 className="font-medium text-surface-900 dark:text-white mb-2">
              Business Reports
            </h3>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Add company logos in headers and page numbers in footers
              for professional-looking reports and presentations.
            </p>
          </div>
          <div className="p-4 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
            <h3 className="font-medium text-surface-900 dark:text-white mb-2">
              Academic Papers
            </h3>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Add page numbers in the required format and running headers
              with paper titles for thesis and dissertation submissions.
            </p>
          </div>
          <div className="p-4 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
            <h3 className="font-medium text-surface-900 dark:text-white mb-2">
              Confidential Documents
            </h3>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Add classification labels in headers (e.g., "CONFIDENTIAL")
              and tracking information in footers.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
