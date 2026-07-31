/**
 * ConvertPanel - PDF conversion functionality component
 * Allows users to convert PDFs to images or text, and images to PDF
 * Includes OCR support for scanned document text extraction
 */

import * as React from 'react'
import {
  FileText,
  FileOutput,
  Download,
  Loader2,
  X,
  Image,
  FileType,
  Package,
  ScanLine,
  Languages,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react'
import JSZip from 'jszip'
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
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { AddToBatchButton } from '@/components/batch/AddToBatchButton'
import { useToast } from '@/hooks/use-toast'
import { useOCR } from '@/hooks/useOCR'
import { usePdfDocument } from '@/hooks/usePdfDocument'
import {
  cn,
  formatFileSize,
  downloadBlob,
  arrayBufferToBlob,
  readFileAsArrayBuffer,
} from '@/lib/utils'
import { convertPDF, extractText, getSupportedFormats } from '@pdflover/pdf-core'
import type { ProgressInfo, ConvertOutputFormat, ImageQuality } from '@pdflover/shared'
import type { OCRLanguageCode } from '@pdflover/pdf-core'
import { useSettingsStore } from '@/store/settings-store'
import { useApiCapabilities } from '@/hooks/useApiCapabilities'
import { getOperationCapability, runServerPdfOperation } from '@/lib/api'
import type { ServerOperationKind } from '@pdflover/shared'

/**
 * Conversion mode
 */
type ConversionMode = 'pdf-to-image' | 'image-to-pdf' | 'pdf-to-text' | 'pdf-to-office'
type OfficeFormat = 'docx' | 'xlsx' | 'pptx'

/**
 * OCR language options for the UI
 */
const OCR_LANGUAGE_OPTIONS: Array<{ code: OCRLanguageCode; name: string }> = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'chi_sim', name: 'Chinese' },
  { code: 'kor', name: 'Korean' },
  { code: 'ara', name: 'Arabic' },
]

/**
 * Output format options for PDF to Image
 */
interface ImageFormatOption {
  value: ConvertOutputFormat
  label: string
  mimeType: string
  extension: string
}

const IMAGE_FORMATS: ImageFormatOption[] = [
  { value: 'png', label: 'PNG', mimeType: 'image/png', extension: 'png' },
  { value: 'jpg', label: 'JPG', mimeType: 'image/jpeg', extension: 'jpg' },
  { value: 'webp', label: 'WebP', mimeType: 'image/webp', extension: 'webp' },
]

/**
 * Quality level configuration
 */
interface QualityConfig {
  level: ImageQuality
  label: string
  description: string
}

const QUALITY_LEVELS: QualityConfig[] = [
  { level: 'low', label: 'Low', description: '72 DPI - Small file size' },
  { level: 'medium', label: 'Medium', description: '150 DPI - Balanced' },
  { level: 'high', label: 'High', description: '300 DPI - High quality' },
  { level: 'maximum', label: 'Maximum', description: '600 DPI - Best quality' },
]

/**
 * Props for ConvertPanel component
 */
export interface ConvertPanelProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * PDF Convert Panel component
 *
 * Features:
 * - Convert PDF to images (PNG, JPG, WebP)
 * - Convert images to PDF
 * - Extract text from PDF
 * - Quality settings for image output
 * - Progress indicator
 * - Download converted files
 */
export function ConvertPanel({ className }: ConvertPanelProps) {
  const processingSettings = useSettingsStore((state) => state.processing)
  const [mode, setMode] = React.useState<ConversionMode>('pdf-to-image')
  const [file, setFile] = React.useState<File | null>(null)
  const [fileBuffer, setFileBuffer] = React.useState<ArrayBuffer | null>(null)
  const [imageFiles, setImageFiles] = React.useState<File[]>([])
  const [pageCount, setPageCount] = React.useState<number>(0)
  const [outputFormat, setOutputFormat] = React.useState<ConvertOutputFormat>('png')
  const [qualityLevel, setQualityLevel] = React.useState<number>(() => {
    const index = QUALITY_LEVELS.findIndex(
      (configuration) => configuration.level === processingSettings.defaultImageQuality,
    )
    return index >= 0 ? index : 1
  })
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const [useOCRForText, setUseOCRForText] = React.useState(false)
  const [ocrLanguages, setOcrLanguages] = React.useState<OCRLanguageCode[]>(() => {
    const configured = OCR_LANGUAGE_OPTIONS.find(
      (language) => language.code === processingSettings.ocrLanguage,
    )?.code
    return [configured ?? 'eng']
  })
  const [isScannedPdf, setIsScannedPdf] = React.useState<boolean | null>(null)
  const [officeFormat, setOfficeFormat] = React.useState<OfficeFormat>('docx')
  const [serverConsent, setServerConsent] = React.useState(false)
  const { toast } = useToast()
  const capabilities = useApiCapabilities()

  const {
    state: ocrState,
    progress: ocrProgress,
    recognizePDF,
    checkIfScanned,
    reset: resetOCR,
  } = useOCR({
    languages: ocrLanguages,
    enableCache: true,
  })

  const {
    pdfDocument,
    loadFromArrayBuffer,
    closeDocument,
  } = usePdfDocument()

  const currentQuality = QUALITY_LEVELS[qualityLevel] ?? QUALITY_LEVELS[1]!
  const supportedFormats = getSupportedFormats()

  /**
   * Reset state when mode changes
   */
  React.useEffect(() => {
    setFile(null)
    setFileBuffer(null)
    setImageFiles([])
    setPageCount(0)
    setIsScannedPdf(null)
    setUseOCRForText(false)
    setServerConsent(false)
    closeDocument()
    resetOCR()
  }, [mode, closeDocument, resetOCR])

  /**
   * Handle PDF file upload
   */
  const handlePdfAccepted = React.useCallback(async (files: File[]) => {
    const pdfFile = files[0]
    if (!pdfFile) return

    setFile(pdfFile)
    setIsScannedPdf(null)

    try {
      const buffer = await pdfFile.arrayBuffer()
      setFileBuffer(buffer)
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
      setPageCount(doc.getPageCount())

      // Load for PDF.js to check if scanned (for text extraction mode)
      if (mode === 'pdf-to-text') {
        await loadFromArrayBuffer(buffer)
      }
    } catch (error) {
      toast({
        title: 'Error reading PDF',
        description: 'Could not read the PDF file. Please try another file.',
        variant: 'destructive',
      })
      setFile(null)
      setFileBuffer(null)
    }
  }, [toast, mode, loadFromArrayBuffer])

  /**
   * Check if PDF is scanned when loaded for text extraction
   */
  React.useEffect(() => {
    if (pdfDocument && mode === 'pdf-to-text') {
      checkIfScanned(pdfDocument).then((isScanned) => {
        setIsScannedPdf(isScanned)
        // Auto-enable OCR for scanned PDFs
        if (isScanned) {
          setUseOCRForText(true)
        }
      })
    }
  }, [pdfDocument, mode, checkIfScanned])

  /**
   * Handle image files upload
   */
  const handleImagesAccepted = React.useCallback((files: File[]) => {
    setImageFiles((prev) => [...prev, ...files])
    toast({
      title: 'Images added',
      description: `Added ${files.length} image(s) to convert`,
    })
  }, [toast])

  /**
   * Remove an image from the list
   */
  const handleRemoveImage = React.useCallback((index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  /**
   * Clear file selection
   */
  const handleClearFile = React.useCallback(() => {
    setFile(null)
    setFileBuffer(null)
    setPageCount(0)
    setIsScannedPdf(null)
    setUseOCRForText(false)
    closeDocument()
    resetOCR()
  }, [closeDocument, resetOCR])

  /**
   * Toggle OCR language selection
   */
  const handleOcrLanguageToggle = React.useCallback((code: OCRLanguageCode) => {
    setOcrLanguages((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev // Keep at least one language
        return prev.filter((l) => l !== code)
      }
      return [...prev, code]
    })
  }, [])

  /**
   * Clear all images
   */
  const handleClearImages = React.useCallback(() => {
    setImageFiles([])
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
   * Convert PDF to images
   */
  const handlePdfToImage = React.useCallback(async () => {
    if (!file) return

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Converting PDF to images...')

    try {
      const buffer = await file.arrayBuffer()
      const result = await convertPDF({
        document: buffer,
        outputFormat,
        imageQuality: currentQuality.level,
        dpi: processingSettings.defaultImageDpi,
        onProgress: handleProgress,
      })

      if (result.success && result.files && result.files.length > 0) {
        if (result.files.length === 1) {
          const fileData = result.files[0]!
          const formatInfo = IMAGE_FORMATS.find((f) => f.value === outputFormat)
          const blob = arrayBufferToBlob(fileData.data, formatInfo?.mimeType ?? 'image/png')
          downloadBlob(blob, fileData.filename)

          toast({
            title: 'Conversion complete',
            description: 'Image downloaded successfully',
          })
        } else {
          const zip = new JSZip()
          for (const fileData of result.files) {
            zip.file(fileData.filename, fileData.data)
          }

          const zipBlob = await zip.generateAsync({ type: 'blob' })
          downloadBlob(zipBlob, 'converted-images.zip')

          toast({
            title: 'Conversion complete',
            description: `Created ${result.files.length} images`,
          })
        }
      } else {
        throw new Error(result.error ?? 'Failed to convert PDF')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Conversion failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [file, outputFormat, currentQuality.level, processingSettings.defaultImageDpi, handleProgress, toast])

  /**
   * Convert images to PDF
   */
  const handleImageToPdf = React.useCallback(async () => {
    if (imageFiles.length === 0) return

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Creating PDF from images...')

    try {
      const pdfDoc = await PDFDocument.create()

      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i]!
        const imageBytes = await readFileAsArrayBuffer(imageFile)

        let image
        const fileType = imageFile.type.toLowerCase()

        if (fileType === 'image/png') {
          image = await pdfDoc.embedPng(imageBytes)
        } else if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
          image = await pdfDoc.embedJpg(imageBytes)
        } else {
          // For other formats, try to convert via canvas
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const img = new window.Image()

          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              canvas.width = img.width
              canvas.height = img.height
              ctx?.drawImage(img, 0, 0)
              resolve()
            }
            img.onerror = reject
            img.src = URL.createObjectURL(imageFile)
          })

          const dataUrl = canvas.toDataURL('image/png')
          const base64Data = dataUrl.split(',')[1]!
          const pngBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
          image = await pdfDoc.embedPng(pngBytes)
        }

        const page = pdfDoc.addPage([image.width, image.height])
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        })

        setProgress(((i + 1) / imageFiles.length) * 100)
        setProgressStage(`Processing image ${i + 1} of ${imageFiles.length}`)
      }

      const pdfBytes = await pdfDoc.save()
      const blob = arrayBufferToBlob(pdfBytes.buffer as ArrayBuffer, 'application/pdf')
      downloadBlob(blob, 'images-to-pdf.pdf')

      toast({
        title: 'Conversion complete',
        description: `Created PDF with ${imageFiles.length} pages`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Conversion failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [imageFiles, toast])

  /**
   * Extract text from PDF (with optional OCR)
   */
  const handlePdfToText = React.useCallback(async () => {
    if (!file) return

    setIsProcessing(true)
    setProgress(0)

    try {
      let text: string | null = null

      if (useOCRForText && pdfDocument) {
        // Use OCR for text extraction
        setProgressStage('Running OCR on PDF...')

        const ocrResult = await recognizePDF(pdfDocument)
        if (ocrResult) {
          text = ocrResult.fullText

          toast({
            title: 'OCR Complete',
            description: `Extracted text with ${Math.round(ocrResult.averageConfidence)}% confidence`,
          })
        }
      } else {
        // Use regular text extraction
        setProgressStage('Extracting text from PDF...')
        const buffer = await file.arrayBuffer()
        text = await extractText(buffer)
      }

      if (text && text.trim().length > 0) {
        const blob = new Blob([text], { type: 'text/plain' })
        const filename = file.name.replace(/\.pdf$/i, useOCRForText ? '_ocr.txt' : '.txt')
        downloadBlob(blob, filename)

        toast({
          title: 'Extraction complete',
          description: 'Text file downloaded successfully',
        })
      } else {
        toast({
          title: 'No text found',
          description: useOCRForText
            ? 'OCR could not extract text from the document.'
            : 'The PDF does not contain extractable text. Try enabling OCR.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Extraction failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [file, useOCRForText, pdfDocument, recognizePDF, toast])

  const officeOperation = `pdf.convert.${officeFormat}` as ServerOperationKind
  const officeCapability = getOperationCapability(capabilities.data, officeOperation)
  const officeAvailable = officeCapability?.available === true

  const handlePdfToOffice = React.useCallback(async () => {
    if (!file || !serverConsent || !officeAvailable) return

    setIsProcessing(true)
    setProgress(0)
    setProgressStage(`Converting PDF to ${officeFormat.toUpperCase()} on the secure backend...`)
    try {
      const artifacts = await runServerPdfOperation({
        operation: officeOperation,
        file,
        options: {},
        onProgress: handleProgress,
      })
      if (artifacts.length === 0) throw new Error('The server returned no converted file')
      for (const artifact of artifacts) {
        downloadBlob(arrayBufferToBlob(artifact.data, artifact.mediaType), artifact.filename)
      }
      toast({
        title: 'Conversion complete',
        description: `${officeFormat.toUpperCase()} file downloaded successfully`,
      })
    } catch (error) {
      toast({
        title: 'Conversion failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [file, serverConsent, officeAvailable, officeFormat, officeOperation, handleProgress, toast])

  /**
   * Handle conversion based on mode
   */
  const handleConvert = React.useCallback(() => {
    switch (mode) {
      case 'pdf-to-image':
        handlePdfToImage()
        break
      case 'image-to-pdf':
        handleImageToPdf()
        break
      case 'pdf-to-text':
        handlePdfToText()
        break
      case 'pdf-to-office':
        handlePdfToOffice()
        break
    }
  }, [mode, handlePdfToImage, handleImageToPdf, handlePdfToText, handlePdfToOffice])

  const canConvert = React.useMemo(() => {
    switch (mode) {
      case 'pdf-to-image':
      case 'pdf-to-text':
        return file !== null
      case 'pdf-to-office':
        return file !== null && serverConsent && officeAvailable
      case 'image-to-pdf':
        return imageFiles.length > 0
      default:
        return false
    }
  }, [mode, file, imageFiles.length, serverConsent, officeAvailable])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileOutput className="h-5 w-5 text-purple-500" />
          Convert PDF
        </CardTitle>
        <CardDescription>
          Convert PDFs to images, text, or Office files, or create PDFs from images.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Conversion Mode Tabs */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as ConversionMode)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="pdf-to-image" className="flex items-center gap-1.5">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">PDF to Image</span>
              <span className="sm:hidden">To Image</span>
            </TabsTrigger>
            <TabsTrigger value="image-to-pdf" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Image to PDF</span>
              <span className="sm:hidden">To PDF</span>
            </TabsTrigger>
            <TabsTrigger value="pdf-to-text" className="flex items-center gap-1.5">
              <FileType className="h-4 w-4" />
              <span className="hidden sm:inline">PDF to Text</span>
              <span className="sm:hidden">To Text</span>
            </TabsTrigger>
            <TabsTrigger value="pdf-to-office" className="flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">PDF to Office</span>
              <span className="sm:hidden">To Office</span>
            </TabsTrigger>
          </TabsList>

          {/* PDF to Image */}
          <TabsContent value="pdf-to-image" className="space-y-4 mt-4">
            {!file ? (
              <FileDropzone
                onFilesAccepted={handlePdfAccepted}
                multiple={false}
                maxFiles={1}
              />
            ) : (
              <>
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
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Output Format */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Output Format
                  </label>
                  <div className="flex gap-2">
                    {IMAGE_FORMATS.map((format) => (
                      <Button
                        key={format.value}
                        variant={outputFormat === format.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setOutputFormat(format.value)}
                        disabled={isProcessing}
                      >
                        {format.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Quality Level */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                      Image Quality
                    </label>
                    <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                      {currentQuality.label}
                    </span>
                  </div>
                  <Slider
                    value={[qualityLevel]}
                    onValueChange={([value]) => setQualityLevel(value ?? 1)}
                    min={0}
                    max={3}
                    step={1}
                    disabled={isProcessing}
                    className="w-full"
                  />
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    {currentQuality.description}
                  </p>
                </div>
              </>
            )}
          </TabsContent>

          {/* Image to PDF */}
          <TabsContent value="image-to-pdf" className="space-y-4 mt-4">
            <FileDropzone
              onFilesAccepted={handleImagesAccepted}
              accept={{
                'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'],
              }}
              multiple
              maxFiles={100}
              disabled={isProcessing}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <Image className="h-10 w-10 text-surface-400" />
                <p className="text-sm text-surface-600 dark:text-surface-400">
                  Drop images here or click to browse
                </p>
                <p className="text-xs text-surface-500">
                  PNG, JPG, WebP, GIF, BMP supported
                </p>
              </div>
            </FileDropzone>

            {imageFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Images ({imageFiles.length})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearImages}
                    disabled={isProcessing}
                    className="text-red-500 hover:text-red-600"
                  >
                    Clear all
                  </Button>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {imageFiles.map((img, index) => (
                    <div
                      key={`${img.name}-${index}`}
                      className="flex items-center gap-3 p-2 bg-surface-50 dark:bg-surface-800 rounded-lg"
                    >
                      <div className="w-10 h-10 bg-card dark:bg-surface-700 rounded overflow-hidden flex items-center justify-center">
                        <img
                          src={URL.createObjectURL(img)}
                          alt={img.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{img.name}</p>
                        <p className="text-xs text-surface-500">
                          {formatFileSize(img.size)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveImage(index)}
                        disabled={isProcessing}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* PDF to Text */}
          <TabsContent value="pdf-to-text" className="space-y-4 mt-4">
            {!file ? (
              <FileDropzone
                onFilesAccepted={handlePdfAccepted}
                multiple={false}
                maxFiles={1}
              />
            ) : (
              <>
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
                    {isScannedPdf !== null && (
                      <p className={cn(
                        'text-xs mt-1',
                        isScannedPdf
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-green-600 dark:text-green-400'
                      )}>
                        {isScannedPdf
                          ? 'Scanned document detected - OCR enabled'
                          : 'Text-based PDF'}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClearFile}
                    disabled={isProcessing || ocrState === 'processing'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* OCR Toggle */}
                <div className="flex items-center gap-3 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                  <ScanLine className="h-5 w-5 text-indigo-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">
                      Use OCR (Optical Character Recognition)
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      Enable for scanned documents or images
                    </p>
                  </div>
                  <Button
                    variant={useOCRForText ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUseOCRForText(!useOCRForText)}
                    disabled={isProcessing || ocrState === 'processing'}
                  >
                    {useOCRForText ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {/* OCR Language Selector */}
                {useOCRForText && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Languages className="h-4 w-4 text-surface-500" />
                      <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                        OCR Languages
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {OCR_LANGUAGE_OPTIONS.map((lang) => (
                        <Button
                          key={lang.code}
                          variant={ocrLanguages.includes(lang.code) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleOcrLanguageToggle(lang.code)}
                          disabled={isProcessing || ocrState === 'processing'}
                          className="text-xs"
                        >
                          {lang.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Info Note */}
            {!useOCRForText && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Note: Text extraction works best with text-based PDFs. Enable OCR above
                  for scanned documents or image-based PDFs.
                </p>
              </div>
            )}

            {useOCRForText && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  OCR processing happens entirely in your browser. No data is sent to any server.
                  Processing time depends on document size.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pdf-to-office" className="mt-4 space-y-4">
            {!file ? (
              <FileDropzone onFilesAccepted={handlePdfAccepted} multiple={false} maxFiles={1} />
            ) : (
              <>
                <div className="flex items-center gap-4 rounded-lg border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-800">
                  <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-card dark:bg-surface-700">
                    <FileText className="h-6 w-6 text-surface-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-surface-900 dark:text-white">{file.name}</p>
                    <p className="text-xs text-surface-500">{formatFileSize(file.size)} · {pageCount} pages</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleClearFile} disabled={isProcessing}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Output format</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['docx', 'xlsx', 'pptx'] as const).map((format) => (
                      <Button
                        key={format}
                        type="button"
                        variant={officeFormat === format ? 'default' : 'outline'}
                        onClick={() => {
                          setOfficeFormat(format)
                          setServerConsent(false)
                        }}
                        disabled={isProcessing}
                      >
                        {format.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-800 dark:bg-blue-950/30">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                    <div className="space-y-2">
                      <p className="font-medium text-blue-950 dark:text-blue-100">Temporary server processing required</p>
                      <p className="text-blue-800 dark:text-blue-200">
                        Office conversion uploads this PDF to the configured PDFLover backend. Job files expire automatically.
                      </p>
                      <label className="flex cursor-pointer items-start gap-2 text-blue-950 dark:text-blue-100">
                        <input
                          type="checkbox"
                          checked={serverConsent}
                          onChange={(event) => setServerConsent(event.target.checked)}
                          disabled={!officeAvailable || isProcessing}
                          className="mt-0.5 h-4 w-4"
                        />
                        I consent to temporary backend processing for this file.
                      </label>
                    </div>
                  </div>
                </div>

                {!capabilities.isLoading && !officeAvailable && (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" role="status">
                    {officeCapability?.unavailableReason ?? 'This Office conversion is unavailable on the configured backend.'}
                  </p>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Progress Indicator */}
        {(isProcessing || ocrState === 'processing' || ocrState === 'initializing') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-600 dark:text-surface-400">
                {ocrState === 'processing' || ocrState === 'initializing'
                  ? ocrProgress.stage || 'Processing OCR...'
                  : progressStage || 'Processing...'}
              </span>
              <span className="font-medium">
                {ocrState === 'processing' || ocrState === 'initializing'
                  ? Math.round(ocrProgress.percentage)
                  : Math.round(progress)}%
              </span>
            </div>
            <Progress
              value={ocrState === 'processing' || ocrState === 'initializing'
                ? ocrProgress.percentage
                : progress}
              className="h-2"
            />
            {ocrProgress.currentPage && ocrProgress.totalPages && (
              <p className="text-xs text-surface-500 dark:text-surface-400 text-center">
                Page {ocrProgress.currentPage} of {ocrProgress.totalPages}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleConvert}
            disabled={!canConvert || isProcessing || ocrState === 'processing' || ocrState === 'initializing'}
            className="flex-1"
          >
            {isProcessing || ocrState === 'processing' || ocrState === 'initializing' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {useOCRForText && mode === 'pdf-to-text' ? 'Running OCR...' : 'Converting...'}
              </>
            ) : (
              <>
                {mode === 'pdf-to-text' && useOCRForText ? (
                  <ScanLine className="h-4 w-4 mr-2" />
                ) : mode === 'image-to-pdf' && imageFiles.length > 1 ? (
                  <Package className="h-4 w-4 mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {mode === 'pdf-to-text' && useOCRForText
                  ? 'Extract with OCR'
                  : 'Convert & Download'}
              </>
            )}
          </Button>

          {file && (mode === 'pdf-to-image' || mode === 'pdf-to-office') && (
            <AddToBatchButton
              operationType="convert"
              files={[file]}
              options={mode === 'pdf-to-office'
                ? { format: officeFormat, serverConsent }
                : { format: outputFormat, quality: 90 }}
              disabled={isProcessing || (mode === 'pdf-to-office' && !officeAvailable)}
              onAdded={handleClearFile}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
