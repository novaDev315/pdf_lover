/**
 * KeyInfoPage - Page wrapper for the PDF key information extraction tool
 * Includes PDF preview with highlight capability
 */

import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Heart, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api'

import { Button } from '@/components/ui/button'
import { KeyInfoDashboard } from '@/components/smart/KeyInfoDashboard'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import type { TextLocation } from '@pdflover/pdf-core'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
}

/**
 * Key Information Extraction page component
 * Provides the full page layout with PDF preview and extraction dashboard
 */
export function KeyInfoPage() {
  const [file, setFile] = React.useState<File | null>(null)
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = React.useState<number>(0)
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [scale, setScale] = React.useState<number>(1.0)
  const [isRendering, setIsRendering] = React.useState<boolean>(false)
  const [highlightLocation, setHighlightLocation] = React.useState<TextLocation | null>(null)
  const [isPdfPanelExpanded, setIsPdfPanelExpanded] = React.useState<boolean>(true)

  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  /**
   * Handle file upload
   */
  const handleFileAccepted = React.useCallback(async (files: File[]) => {
    const pdfFile = files[0]
    if (!pdfFile) return

    setFile(pdfFile)
    setHighlightLocation(null)

    try {
      const buffer = await pdfFile.arrayBuffer()
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise
      setPdfDoc(doc)
      setPageCount(doc.numPages)
      setCurrentPage(1)
    } catch {
      toast({
        title: 'Error reading PDF',
        description: 'Could not read the PDF file. Please try another file.',
        variant: 'destructive',
      })
      setFile(null)
      setPdfDoc(null)
    }
  }, [toast])

  /**
   * Render the current page
   */
  const renderPage = React.useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || isRendering) return

    setIsRendering(true)

    try {
      const page: PDFPageProxy = await pdfDoc.getPage(currentPage)
      const viewport = page.getViewport({ scale })

      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (!context) {
        setIsRendering(false)
        return
      }

      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport,
      }).promise

      setIsRendering(false)
    } catch (error) {
      console.error('Error rendering page:', error)
      setIsRendering(false)
    }
  }, [pdfDoc, currentPage, scale, isRendering])

  // Render page when dependencies change
  React.useEffect(() => {
    renderPage()
  }, [pdfDoc, currentPage, scale])

  /**
   * Handle item click from dashboard - navigate to page
   */
  const handleItemClick = React.useCallback((location: TextLocation) => {
    setCurrentPage(location.page)
    setHighlightLocation(location)

    // Scroll to top of PDF viewer
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })

    toast({
      title: 'Navigated to page ' + location.page,
      description: `Showing "${location.text.substring(0, 50)}${location.text.length > 50 ? '...' : ''}"`,
    })
  }, [toast])

  /**
   * Zoom controls
   */
  const handleZoomIn = React.useCallback(() => {
    setScale((s) => Math.min(s + 0.25, 3.0))
  }, [])

  const handleZoomOut = React.useCallback(() => {
    setScale((s) => Math.max(s - 0.25, 0.5))
  }, [])

  /**
   * Page navigation
   */
  const goToPrevPage = React.useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 1))
    setHighlightLocation(null)
  }, [])

  const goToNextPage = React.useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, pageCount))
    setHighlightLocation(null)
  }, [pageCount])

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex flex-col">
      {/* Header */}
      <header className="bg-card dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <span className="text-surface-900 dark:text-white font-medium">Key Information</span>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row">
        {/* PDF Preview Panel */}
        {file && pdfDoc && (
          <div
            className={cn(
              'bg-surface-100 dark:bg-surface-900 border-b lg:border-b-0 lg:border-r border-surface-200 dark:border-surface-800 flex flex-col transition-all duration-300',
              isPdfPanelExpanded ? 'lg:w-1/2 xl:w-2/5' : 'lg:w-12'
            )}
          >
            {/* PDF Toolbar */}
            <div className="flex items-center justify-between p-2 bg-card dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
              {isPdfPanelExpanded ? (
                <>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToPrevPage}
                      disabled={currentPage <= 1}
                      className="h-8 w-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-surface-600 dark:text-surface-400 min-w-[80px] text-center">
                      {currentPage} / {pageCount}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToNextPage}
                      disabled={currentPage >= pageCount}
                      className="h-8 w-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleZoomOut}
                      disabled={scale <= 0.5}
                      className="h-8 w-8"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-surface-500 min-w-[40px] text-center">
                      {Math.round(scale * 100)}%
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleZoomIn}
                      disabled={scale >= 3.0}
                      className="h-8 w-8"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsPdfPanelExpanded(false)}
                      className="h-8 w-8"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsPdfPanelExpanded(true)}
                  className="h-8 w-8 mx-auto"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* PDF Canvas */}
            {isPdfPanelExpanded && (
              <div
                ref={containerRef}
                className="flex-1 overflow-auto p-4 flex items-start justify-center"
              >
                <div className="relative shadow-lg">
                  <canvas ref={canvasRef} className="bg-white" />
                  {/* Highlight overlay - shows when navigating to an item */}
                  {highlightLocation && highlightLocation.page === currentPage && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="w-full h-full bg-yellow-400/20 animate-pulse" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dashboard Panel */}
        <div className={cn(
          'flex-1 overflow-auto p-4 lg:p-8',
          !file && 'max-w-4xl mx-auto w-full'
        )}>
          {!file ? (
            <div className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
                  Extract Key Information
                </h1>
                <p className="text-surface-600 dark:text-surface-400">
                  Automatically extract dates, amounts, names, emails, phone numbers, addresses,
                  URLs, and IDs from your PDF documents. All processing happens locally in your browser.
                </p>
              </div>

              <FileDropzone
                onFilesAccepted={handleFileAccepted}
                multiple={false}
                maxFiles={1}
              />

              {/* Features Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FeatureCard
                  title="Dates"
                  description="Detect dates in various formats including ISO, US, EU, and written forms"
                />
                <FeatureCard
                  title="Amounts"
                  description="Extract monetary values with currency detection (USD, EUR, GBP, etc.)"
                />
                <FeatureCard
                  title="Contacts"
                  description="Find email addresses and phone numbers with format normalization"
                />
                <FeatureCard
                  title="References"
                  description="Identify URLs, IDs, invoice numbers, and tracking numbers"
                />
              </div>

              {/* Tips Section */}
              <div className="p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
                <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
                  Tips for best results
                </h2>
                <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">-</span>
                    Text-based PDFs work best. Use OCR for scanned documents first.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">-</span>
                    Click any extracted item to navigate to its location in the PDF.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">-</span>
                    Use the search bar to filter results across all categories.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">-</span>
                    Export results as JSON for programmatic use or CSV for spreadsheets.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-500">-</span>
                    All processing happens locally - your documents never leave your browser.
                  </li>
                </ul>
              </div>

              {/* Supported Formats */}
              <div className="p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
                <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
                  What can be extracted
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h3 className="font-medium text-surface-900 dark:text-white mb-2">Dates</h3>
                    <ul className="space-y-1 text-surface-600 dark:text-surface-400">
                      <li>ISO: 2024-01-15</li>
                      <li>US: 01/15/2024</li>
                      <li>EU: 15.01.2024</li>
                      <li>Long: January 15, 2024</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium text-surface-900 dark:text-white mb-2">Amounts</h3>
                    <ul className="space-y-1 text-surface-600 dark:text-surface-400">
                      <li>USD: $1,234.56</li>
                      <li>EUR: 1.234,56</li>
                      <li>Multiple currencies</li>
                      <li>Total calculation</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium text-surface-900 dark:text-white mb-2">Contacts</h3>
                    <ul className="space-y-1 text-surface-600 dark:text-surface-400">
                      <li>Email addresses</li>
                      <li>Phone numbers (US, Intl)</li>
                      <li>Person names</li>
                      <li>Physical addresses</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium text-surface-900 dark:text-white mb-2">IDs & References</h3>
                    <ul className="space-y-1 text-surface-600 dark:text-surface-400">
                      <li>Invoice numbers</li>
                      <li>Order numbers</li>
                      <li>Tracking numbers</li>
                      <li>URLs and domains</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <KeyInfoDashboard
              externalPdfDoc={pdfDoc ?? undefined}
              externalFile={file}
              onItemClick={handleItemClick}
            />
          )}
        </div>
      </main>
    </div>
  )
}

/**
 * Feature card component
 */
interface FeatureCardProps {
  title: string
  description: string
}

function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <div className="p-4 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
      <h3 className="font-medium text-surface-900 dark:text-white mb-1">{title}</h3>
      <p className="text-xs text-surface-500 dark:text-surface-400">{description}</p>
    </div>
  )
}
