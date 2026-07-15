/**
 * SplitPanel - PDF split functionality component
 * Allows users to split a PDF into multiple documents
 */

import * as React from 'react'
import {
  FileText,
  Scissors,
  Download,
  Loader2,
  Upload,
  X,
  Package,
} from 'lucide-react'
import JSZip from 'jszip'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { AddToBatchButton } from '@/components/batch/AddToBatchButton'
import { useToast } from '@/hooks/use-toast'
import { useOperationHistory } from '@/hooks/useOperationHistory'
import {
  cn,
  formatFileSize,
  downloadBlob,
  arrayBufferToBlob,
} from '@/lib/utils'
import { splitPDF, splitIntoParts, extractPages } from '@pdflover/pdf-core'
import type { ProgressInfo, PageRange } from '@pdflover/shared'

/**
 * Split mode options
 */
type SplitMode = 'pages' | 'range' | 'every'

/**
 * Props for SplitPanel component
 */
export interface SplitPanelProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * Parse page range string into PageRange objects
 * Supports formats: "1-5, 8, 10-12"
 */
function parsePageRanges(input: string, maxPage: number): PageRange[] | null {
  if (!input.trim()) return null

  const ranges: PageRange[] = []
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean)

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim())
      const start = parseInt(startStr ?? '', 10)
      const end = parseInt(endStr ?? '', 10)

      if (isNaN(start) || isNaN(end) || start < 1 || end > maxPage || start > end) {
        return null
      }
      ranges.push({ start, end })
    } else {
      const page = parseInt(part, 10)
      if (isNaN(page) || page < 1 || page > maxPage) {
        return null
      }
      ranges.push({ start: page, end: page })
    }
  }

  return ranges.length > 0 ? ranges : null
}

/**
 * PDF Split Panel component
 *
 * Features:
 * - Upload single PDF
 * - Multiple split modes (by pages, by range, every N pages)
 * - Page range input with validation
 * - Preview selected pages
 * - Download individual files or as ZIP
 */
export function SplitPanel({ className }: SplitPanelProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [pageCount, setPageCount] = React.useState<number>(0)
  const [splitMode, setSplitMode] = React.useState<SplitMode>('pages')
  const [pageRangeInput, setPageRangeInput] = React.useState('')
  const [everyNPages, setEveryNPages] = React.useState(1)
  const [selectedPages, setSelectedPages] = React.useState<number[]>([])
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const { toast } = useToast()
  const { recordOperation } = useOperationHistory({ showToasts: false })

  /**
   * Handle file upload
   */
  const handleFileAccepted = React.useCallback(async (files: File[]) => {
    const pdfFile = files[0]
    if (!pdfFile) return

    setFile(pdfFile)

    // Get page count from PDF
    try {
      const { PDFDocument } = await import('pdf-lib')
      const buffer = await pdfFile.arrayBuffer()
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
      setPageCount(doc.getPageCount())
    } catch (error) {
      toast({
        title: 'Error reading PDF',
        description: 'Could not read the PDF file. Please try another file.',
        variant: 'destructive',
      })
      setFile(null)
    }
  }, [toast])

  /**
   * Clear the selected file
   */
  const handleClearFile = React.useCallback(() => {
    setFile(null)
    setPageCount(0)
    setPageRangeInput('')
    setSelectedPages([])
  }, [])

  /**
   * Handle progress updates
   */
  const handleProgress = React.useCallback((info: ProgressInfo) => {
    setProgress(info.percentage)
    if (info.stage) {
      setProgressStage(info.stage)
    }
  }, [])

  /**
   * Toggle page selection
   */
  const togglePageSelection = React.useCallback((page: number) => {
    setSelectedPages((prev) =>
      prev.includes(page)
        ? prev.filter((p) => p !== page)
        : [...prev, page].sort((a, b) => a - b)
    )
  }, [])

  /**
   * Select all pages
   */
  const selectAllPages = React.useCallback(() => {
    setSelectedPages(Array.from({ length: pageCount }, (_, i) => i + 1))
  }, [pageCount])

  /**
   * Clear page selection
   */
  const clearPageSelection = React.useCallback(() => {
    setSelectedPages([])
  }, [])

  /**
   * Validate page range input
   */
  const pageRanges = React.useMemo(() => {
    if (splitMode !== 'range' || !pageRangeInput) return null
    return parsePageRanges(pageRangeInput, pageCount)
  }, [splitMode, pageRangeInput, pageCount])

  const isValidInput = React.useMemo(() => {
    switch (splitMode) {
      case 'pages':
        return selectedPages.length > 0
      case 'range':
        return pageRanges !== null
      case 'every':
        return everyNPages > 0 && everyNPages <= pageCount
      default:
        return false
    }
  }, [splitMode, selectedPages, pageRanges, everyNPages, pageCount])

  /**
   * Perform the split operation
   */
  const handleSplit = React.useCallback(async () => {
    if (!file || !isValidInput) return

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting split...')

    try {
      const buffer = await file.arrayBuffer()
      let result

      switch (splitMode) {
        case 'pages':
          result = await extractPages(buffer, selectedPages)
          break
        case 'range':
          result = await splitPDF({
            document: buffer,
            mode: 'range',
            ranges: pageRanges!,
            onProgress: handleProgress,
          })
          break
        case 'every':
          result = await splitIntoParts(buffer, Math.ceil(pageCount / everyNPages))
          break
        default:
          throw new Error('Invalid split mode')
      }

      if (result.success && result.files && result.files.length > 0) {
        if (result.files.length === 1) {
          // Single file - download directly
          const fileData = result.files[0]!
          const blob = arrayBufferToBlob(fileData.data, 'application/pdf')
          downloadBlob(blob, fileData.filename)

          toast({
            title: 'Split complete',
            description: `Extracted ${fileData.pageCount} pages`,
          })

          // Record to operation history
          recordOperation({
            type: 'split',
            description: `Extracted ${fileData.pageCount} pages from ${file.name}`,
            canUndo: false,
            fileNames: [file.name],
            fileSize: fileData.data.byteLength,
          })
        } else {
          // Multiple files - create ZIP
          const zip = new JSZip()
          for (const fileData of result.files) {
            zip.file(fileData.filename, fileData.data)
          }

          const zipBlob = await zip.generateAsync({ type: 'blob' })
          downloadBlob(zipBlob, 'split-pdfs.zip')

          toast({
            title: 'Split complete',
            description: `Created ${result.files.length} PDF files`,
          })

          // Record to operation history
          recordOperation({
            type: 'split',
            description: `Split ${file.name} into ${result.files.length} files`,
            canUndo: false,
            fileNames: [file.name],
            fileSize: result.files.reduce((sum, f) => sum + f.data.byteLength, 0),
          })
        }
      } else {
        throw new Error(result.error ?? 'Failed to split PDF')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Split failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [
    file,
    isValidInput,
    splitMode,
    selectedPages,
    pageRanges,
    pageCount,
    everyNPages,
    handleProgress,
    toast,
  ])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-green-500" />
          Split PDF
        </CardTitle>
        <CardDescription>
          Extract pages or split a PDF into multiple files.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload */}
        {!file ? (
          <FileDropzone
            onFilesAccepted={handleFileAccepted}
            multiple={false}
            maxFiles={1}
          />
        ) : (
          <div className="flex items-center gap-4 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
            <div className="flex-shrink-0 w-12 h-16 bg-card dark:bg-surface-700 rounded flex items-center justify-center">
              <FileText className="h-6 w-6 text-surface-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                {file.name}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {formatFileSize(file.size)} - {pageCount} pages
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearFile}
              disabled={isProcessing}
              className="text-surface-400 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Split Options */}
        {file && pageCount > 0 && (
          <Tabs value={splitMode} onValueChange={(v) => setSplitMode(v as SplitMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pages">Select Pages</TabsTrigger>
              <TabsTrigger value="range">Page Ranges</TabsTrigger>
              <TabsTrigger value="every">Every N Pages</TabsTrigger>
            </TabsList>

            <TabsContent value="pages" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-surface-600 dark:text-surface-400">
                  Click pages to select ({selectedPages.length} selected)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllPages}
                    disabled={isProcessing}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearPageSelection}
                    disabled={isProcessing || selectedPages.length === 0}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[200px] overflow-y-auto p-2">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => togglePageSelection(page)}
                    disabled={isProcessing}
                    className={cn(
                      'w-10 h-10 rounded-md text-sm font-medium transition-colors',
                      selectedPages.includes(page)
                        ? 'bg-primary-500 text-white'
                        : 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                    )}
                  >
                    {page}
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="range" className="space-y-4 mt-4">
              <div className="space-y-2">
                <label
                  htmlFor="page-range"
                  className="text-sm font-medium text-surface-700 dark:text-surface-300"
                >
                  Page Ranges
                </label>
                <Input
                  id="page-range"
                  placeholder="e.g., 1-5, 8, 10-12"
                  value={pageRangeInput}
                  onChange={(e) => setPageRangeInput(e.target.value)}
                  disabled={isProcessing}
                  className={cn(
                    pageRangeInput && !pageRanges && 'border-red-500 focus-visible:ring-red-500'
                  )}
                />
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Enter page numbers or ranges separated by commas. Document has {pageCount} pages.
                </p>
                {pageRangeInput && !pageRanges && (
                  <p className="text-xs text-red-500">
                    Invalid page range. Please check your input.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="every" className="space-y-4 mt-4">
              <div className="space-y-2">
                <label
                  htmlFor="every-n"
                  className="text-sm font-medium text-surface-700 dark:text-surface-300"
                >
                  Split every N pages
                </label>
                <Input
                  id="every-n"
                  type="number"
                  min={1}
                  max={pageCount}
                  value={everyNPages}
                  onChange={(e) => setEveryNPages(parseInt(e.target.value, 10) || 1)}
                  disabled={isProcessing}
                />
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  This will create {Math.ceil(pageCount / everyNPages)} file(s) with{' '}
                  {everyNPages} page(s) each.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Progress Indicator */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-600 dark:text-surface-400">
                {progressStage || 'Processing...'}
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Action Buttons */}
        {file && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSplit}
              disabled={!isValidInput || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Splitting...
                </>
              ) : (
                <>
                  {splitMode === 'pages' && selectedPages.length === 1 ? (
                    <Download className="h-4 w-4 mr-2" />
                  ) : (
                    <Package className="h-4 w-4 mr-2" />
                  )}
                  Split & Download
                </>
              )}
            </Button>

            <AddToBatchButton
              operationType="split"
              files={[file]}
              options={{
                mode: splitMode === 'pages' ? 'all' : splitMode === 'range' ? 'range' : 'all',
                ranges: splitMode === 'range' ? pageRangeInput : undefined,
              }}
              disabled={!isValidInput || isProcessing}
              onAdded={handleClearFile}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
