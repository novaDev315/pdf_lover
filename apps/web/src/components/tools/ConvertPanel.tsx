/**
 * ConvertPanel - PDF conversion functionality component
 * Allows users to convert PDFs to images or text, and images to PDF
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
import { useToast } from '@/hooks/use-toast'
import {
  cn,
  formatFileSize,
  downloadBlob,
  arrayBufferToBlob,
  readFileAsArrayBuffer,
} from '@/lib/utils'
import { convertPDF, extractText, getSupportedFormats } from '@pdflover/pdf-core'
import type { ProgressInfo, ConvertOutputFormat, ImageQuality } from '@pdflover/shared'

/**
 * Conversion mode
 */
type ConversionMode = 'pdf-to-image' | 'image-to-pdf' | 'pdf-to-text'

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
  const [mode, setMode] = React.useState<ConversionMode>('pdf-to-image')
  const [file, setFile] = React.useState<File | null>(null)
  const [imageFiles, setImageFiles] = React.useState<File[]>([])
  const [pageCount, setPageCount] = React.useState<number>(0)
  const [outputFormat, setOutputFormat] = React.useState<ConvertOutputFormat>('png')
  const [qualityLevel, setQualityLevel] = React.useState<number>(1) // Index in QUALITY_LEVELS
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const { toast } = useToast()

  const currentQuality = QUALITY_LEVELS[qualityLevel] ?? QUALITY_LEVELS[1]!
  const supportedFormats = getSupportedFormats()

  /**
   * Reset state when mode changes
   */
  React.useEffect(() => {
    setFile(null)
    setImageFiles([])
    setPageCount(0)
  }, [mode])

  /**
   * Handle PDF file upload
   */
  const handlePdfAccepted = React.useCallback(async (files: File[]) => {
    const pdfFile = files[0]
    if (!pdfFile) return

    setFile(pdfFile)

    try {
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
    setPageCount(0)
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
  }, [file, outputFormat, currentQuality.level, handleProgress, toast])

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
   * Extract text from PDF
   */
  const handlePdfToText = React.useCallback(async () => {
    if (!file) return

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Extracting text from PDF...')

    try {
      const buffer = await file.arrayBuffer()
      const text = await extractText(buffer)

      if (text) {
        const blob = new Blob([text], { type: 'text/plain' })
        const filename = file.name.replace(/\.pdf$/i, '.txt')
        downloadBlob(blob, filename)

        toast({
          title: 'Extraction complete',
          description: 'Text file downloaded successfully',
        })
      } else {
        toast({
          title: 'No text found',
          description: 'The PDF does not contain extractable text or is image-based.',
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
  }, [file, toast])

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
    }
  }, [mode, handlePdfToImage, handleImageToPdf, handlePdfToText])

  const canConvert = React.useMemo(() => {
    switch (mode) {
      case 'pdf-to-image':
      case 'pdf-to-text':
        return file !== null
      case 'image-to-pdf':
        return imageFiles.length > 0
      default:
        return false
    }
  }, [mode, file, imageFiles.length])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileOutput className="h-5 w-5 text-purple-500" />
          Convert PDF
        </CardTitle>
        <CardDescription>
          Convert PDFs to images or text, or create PDFs from images.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Conversion Mode Tabs */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as ConversionMode)}>
          <TabsList className="grid w-full grid-cols-3">
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
                  <div className="flex-shrink-0 w-12 h-16 bg-white dark:bg-surface-700 rounded flex items-center justify-center">
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
                      <div className="w-10 h-10 bg-white dark:bg-surface-700 rounded overflow-hidden flex items-center justify-center">
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
              <div className="flex items-center gap-4 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                <div className="flex-shrink-0 w-12 h-16 bg-white dark:bg-surface-700 rounded flex items-center justify-center">
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
            )}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Note: Text extraction works best with text-based PDFs. Scanned documents
                may require OCR which is available in the full application.
              </p>
            </div>
          </TabsContent>
        </Tabs>

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

        {/* Action Button */}
        <Button
          onClick={handleConvert}
          disabled={!canConvert || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Converting...
            </>
          ) : (
            <>
              {mode === 'image-to-pdf' && imageFiles.length > 1 ? (
                <Package className="h-4 w-4 mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Convert & Download
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
