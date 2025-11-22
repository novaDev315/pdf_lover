/**
 * OCRPanel - Optical Character Recognition functionality component
 * Allows users to extract text from scanned PDFs and images using Tesseract.js
 */

import * as React from 'react'
import {
  FileText,
  ScanLine,
  Download,
  Loader2,
  X,
  Copy,
  Check,
  Languages,
  FileSearch,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { PDFDocument } from 'pdf-lib'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { useToast } from '@/hooks/use-toast'
import { useOCR, type OCRState } from '@/hooks/useOCR'
import { usePdfDocument } from '@/hooks/usePdfDocument'
import {
  cn,
  formatFileSize,
  downloadBlob,
  arrayBufferToBlob,
} from '@/lib/utils'
import { addTextLayerToPDF } from '@pdflover/pdf-core'
import type { OCRLanguageCode, OCRResult } from '@pdflover/pdf-core'

/**
 * Supported OCR languages for the UI
 */
const LANGUAGE_OPTIONS: Array<{ code: OCRLanguageCode; name: string }> = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'nld', name: 'Dutch' },
  { code: 'pol', name: 'Polish' },
  { code: 'rus', name: 'Russian' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'chi_tra', name: 'Chinese (Traditional)' },
  { code: 'kor', name: 'Korean' },
  { code: 'ara', name: 'Arabic' },
  { code: 'hin', name: 'Hindi' },
]

/**
 * OCR mode selection
 */
type OCRMode = 'extract-text' | 'searchable-pdf'

/**
 * Props for OCRPanel component
 */
export interface OCRPanelProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * OCR Panel component
 *
 * Features:
 * - Language selector (multiple languages)
 * - OCR progress indicator
 * - Text preview with copy functionality
 * - Create searchable PDF option
 * - Download extracted text
 */
export function OCRPanel({ className }: OCRPanelProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [fileBuffer, setFileBuffer] = React.useState<ArrayBuffer | null>(null)
  const [pageCount, setPageCount] = React.useState<number>(0)
  const [mode, setMode] = React.useState<OCRMode>('extract-text')
  const [selectedLanguages, setSelectedLanguages] = React.useState<OCRLanguageCode[]>(['eng'])
  const [extractedText, setExtractedText] = React.useState<string | null>(null)
  const [searchablePdfData, setSearchablePdfData] = React.useState<ArrayBuffer | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [isScanned, setIsScanned] = React.useState<boolean | null>(null)
  const { toast } = useToast()

  const {
    state,
    progress,
    result,
    error,
    recognizePDF,
    checkIfScanned,
    cancel,
    reset,
    estimateTime,
  } = useOCR({
    languages: selectedLanguages,
    enableCache: true,
    onComplete: handleOCRComplete,
    onError: handleOCRError,
  })

  const {
    pdfDocument,
    loadFromArrayBuffer,
    closeDocument,
  } = usePdfDocument()

  /**
   * Handle OCR completion
   */
  function handleOCRComplete(ocrResult: OCRResult) {
    setExtractedText(ocrResult.fullText)

    toast({
      title: 'OCR Complete',
      description: `Extracted text from ${ocrResult.pages.length} page(s) with ${Math.round(ocrResult.averageConfidence)}% average confidence`,
    })
  }

  /**
   * Handle OCR error
   */
  function handleOCRError(errorMsg: string) {
    toast({
      title: 'OCR Failed',
      description: errorMsg,
      variant: 'destructive',
    })
  }

  /**
   * Handle file upload
   */
  const handleFileAccepted = React.useCallback(async (files: File[]) => {
    const pdfFile = files[0]
    if (!pdfFile) return

    setFile(pdfFile)
    setExtractedText(null)
    setSearchablePdfData(null)
    setIsScanned(null)
    reset()

    try {
      const buffer = await pdfFile.arrayBuffer()
      setFileBuffer(buffer)

      // Load PDF to get page count and check if scanned
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
      setPageCount(doc.getPageCount())

      // Load with PDF.js for OCR
      await loadFromArrayBuffer(buffer)
    } catch (err) {
      toast({
        title: 'Error reading PDF',
        description: 'Could not read the PDF file. Please try another file.',
        variant: 'destructive',
      })
      setFile(null)
    }
  }, [loadFromArrayBuffer, reset, toast])

  /**
   * Check if PDF is scanned
   */
  React.useEffect(() => {
    if (pdfDocument) {
      checkIfScanned(pdfDocument).then(setIsScanned)
    }
  }, [pdfDocument, checkIfScanned])

  /**
   * Clear file selection
   */
  const handleClearFile = React.useCallback(() => {
    setFile(null)
    setFileBuffer(null)
    setPageCount(0)
    setExtractedText(null)
    setSearchablePdfData(null)
    setIsScanned(null)
    closeDocument()
    reset()
  }, [closeDocument, reset])

  /**
   * Toggle language selection
   */
  const handleLanguageToggle = React.useCallback((code: OCRLanguageCode) => {
    setSelectedLanguages((prev) => {
      if (prev.includes(code)) {
        // Don't allow removing last language
        if (prev.length === 1) return prev
        return prev.filter((l) => l !== code)
      }
      return [...prev, code]
    })
  }, [])

  /**
   * Run OCR
   */
  const handleRunOCR = React.useCallback(async () => {
    if (!pdfDocument) return

    const ocrResult = await recognizePDF(pdfDocument)

    // If creating searchable PDF, also create the PDF with text layer
    if (mode === 'searchable-pdf' && ocrResult && fileBuffer) {
      try {
        const result = await addTextLayerToPDF(
          new Uint8Array(fileBuffer),
          ocrResult,
          2 // Scale used for OCR
        )

        if (result.success && result.data) {
          setSearchablePdfData(result.data)
        }
      } catch (err) {
        console.error('Failed to create searchable PDF:', err)
      }
    }
  }, [pdfDocument, fileBuffer, mode, recognizePDF])

  /**
   * Copy text to clipboard
   */
  const handleCopyText = React.useCallback(async () => {
    if (!extractedText) return

    try {
      await navigator.clipboard.writeText(extractedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      toast({
        title: 'Copied',
        description: 'Text copied to clipboard',
      })
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy text to clipboard',
        variant: 'destructive',
      })
    }
  }, [extractedText, toast])

  /**
   * Download extracted text
   */
  const handleDownloadText = React.useCallback(() => {
    if (!extractedText || !file) return

    const blob = new Blob([extractedText], { type: 'text/plain' })
    const filename = file.name.replace(/\.pdf$/i, '_ocr.txt')
    downloadBlob(blob, filename)
  }, [extractedText, file])

  /**
   * Download searchable PDF
   */
  const handleDownloadSearchablePdf = React.useCallback(() => {
    if (!searchablePdfData || !file) return

    const blob = arrayBufferToBlob(searchablePdfData, 'application/pdf')
    const filename = file.name.replace(/\.pdf$/i, '_searchable.pdf')
    downloadBlob(blob, filename)
  }, [searchablePdfData, file])

  /**
   * Calculate estimated time
   */
  const estimatedTimeString = React.useMemo(() => {
    if (!pageCount) return null
    const ms = estimateTime(pageCount)
    const seconds = Math.ceil(ms / 1000)
    if (seconds < 60) return `~${seconds} seconds`
    const minutes = Math.ceil(seconds / 60)
    return `~${minutes} minute${minutes > 1 ? 's' : ''}`
  }, [pageCount, estimateTime])

  /**
   * Check if processing is active
   */
  const isProcessing = state === 'initializing' || state === 'processing'

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-indigo-500" />
          OCR - Text Recognition
        </CardTitle>
        <CardDescription>
          Extract text from scanned PDFs and images using AI-powered OCR.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Selection */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as OCRMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="extract-text" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Extract Text</span>
              <span className="sm:hidden">Text</span>
            </TabsTrigger>
            <TabsTrigger value="searchable-pdf" className="flex items-center gap-1.5">
              <FileSearch className="h-4 w-4" />
              <span className="hidden sm:inline">Searchable PDF</span>
              <span className="sm:hidden">Searchable</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extract-text" className="mt-4">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Extract all text from the PDF and save as a text file.
            </p>
          </TabsContent>

          <TabsContent value="searchable-pdf" className="mt-4">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Add an invisible text layer to make the PDF searchable and selectable.
            </p>
          </TabsContent>
        </Tabs>

        {/* File Upload */}
        {!file ? (
          <FileDropzone
            onFilesAccepted={handleFileAccepted}
            multiple={false}
            maxFiles={1}
          />
        ) : (
          <div className="flex items-center gap-4 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
            <div className="flex-shrink-0 w-12 h-16 bg-white dark:bg-surface-700 rounded flex items-center justify-center">
              <FileText className="h-6 w-6 text-surface-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                {file.name}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {formatFileSize(file.size)} - {pageCount} page{pageCount !== 1 ? 's' : ''}
              </p>
              {isScanned !== null && (
                <p className={cn(
                  'text-xs mt-1',
                  isScanned
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-green-600 dark:text-green-400'
                )}>
                  {isScanned
                    ? 'Appears to be scanned - OCR recommended'
                    : 'Contains text - OCR may improve results'}
                </p>
              )}
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

        {/* Language Selector */}
        {file && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-surface-500" />
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                OCR Languages
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((lang) => (
                <Button
                  key={lang.code}
                  variant={selectedLanguages.includes(lang.code) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleLanguageToggle(lang.code)}
                  disabled={isProcessing}
                  className="text-xs"
                >
                  {lang.name}
                </Button>
              ))}
            </div>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Select the language(s) present in the document for best results.
              Multiple languages can be selected.
            </p>
          </div>
        )}

        {/* Estimated Time */}
        {file && estimatedTimeString && !extractedText && !isProcessing && (
          <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
            <Clock className="h-4 w-4" />
            <span>Estimated processing time: {estimatedTimeString}</span>
          </div>
        )}

        {/* Progress Indicator */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-600 dark:text-surface-400">
                {progress.stage || 'Processing...'}
              </span>
              <span className="font-medium">{Math.round(progress.percentage)}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
            {progress.currentPage && progress.totalPages && (
              <p className="text-xs text-surface-500 dark:text-surface-400 text-center">
                Page {progress.currentPage} of {progress.totalPages}
              </p>
            )}
          </div>
        )}

        {/* Error Display */}
        {state === 'error' && error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-medium">OCR Failed</p>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
        )}

        {/* Text Preview */}
        {extractedText && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Extracted Text
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyText}
                  className="text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 max-h-64 overflow-y-auto">
              <pre className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap font-mono">
                {extractedText.slice(0, 5000)}
                {extractedText.length > 5000 && (
                  <span className="text-surface-500">
                    {'\n\n'}... ({extractedText.length - 5000} more characters)
                  </span>
                )}
              </pre>
            </div>
            {result && (
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Average confidence: {Math.round(result.averageConfidence)}%
                {' | '}
                {result.pages.length} page{result.pages.length !== 1 ? 's' : ''} processed
                {' | '}
                {result.totalTime}ms processing time
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {file && (
          <div className="flex flex-col sm:flex-row gap-3">
            {!extractedText ? (
              <Button
                onClick={handleRunOCR}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ScanLine className="h-4 w-4 mr-2" />
                    Run OCR
                  </>
                )}
              </Button>
            ) : (
              <>
                {mode === 'extract-text' ? (
                  <Button onClick={handleDownloadText} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download Text File
                  </Button>
                ) : searchablePdfData ? (
                  <Button onClick={handleDownloadSearchablePdf} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download Searchable PDF
                  </Button>
                ) : (
                  <Button onClick={handleRunOCR} className="flex-1">
                    <FileSearch className="h-4 w-4 mr-2" />
                    Create Searchable PDF
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleRunOCR}
                  disabled={isProcessing}
                >
                  Re-run OCR
                </Button>
              </>
            )}

            {isProcessing && (
              <Button variant="outline" onClick={cancel}>
                Cancel
              </Button>
            )}
          </div>
        )}

        {/* Info Note */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> OCR processing happens entirely in your browser.
            No data is sent to any server. Processing time depends on document
            size and your device's capabilities.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
