/**
 * ExtractImagesPanel - PDF image extraction component
 * Allows users to extract images from PDF files
 */

import * as React from 'react'
import {
  Image,
  Download,
  Loader2,
  X,
  FileText,
  Package,
  Check,
  Filter,
  Grid,
  List,
  ZoomIn,
} from 'lucide-react'
import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

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
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { useToast } from '@/hooks/use-toast'
import { useImageExtraction } from '@/hooks/useImageExtraction'
import {
  cn,
  formatFileSize,
  downloadBlob,
} from '@/lib/utils'
import type { ExtractedImage } from '@pdflover/pdf-core'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
}

/**
 * Output format options
 */
type OutputFormat = 'original' | 'png' | 'jpeg' | 'webp'

/**
 * View mode for gallery
 */
type ViewMode = 'grid' | 'list'

/**
 * Props for ExtractImagesPanel component
 */
export interface ExtractImagesPanelProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * PDF Image Extraction Panel component
 *
 * Features:
 * - Upload single PDF
 * - Preview all images in a gallery
 * - Filter by size
 * - Select/deselect images
 * - Download selected or all as ZIP
 * - Format conversion (PNG, JPEG, WebP)
 * - Quality slider for lossy formats
 */
export function ExtractImagesPanel({ className }: ExtractImagesPanelProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = React.useState<number>(0)
  const [selectedImages, setSelectedImages] = React.useState<Set<number>>(new Set())
  const [minWidth, setMinWidth] = React.useState(0)
  const [minHeight, setMinHeight] = React.useState(0)
  const [outputFormat, setOutputFormat] = React.useState<OutputFormat>('original')
  const [quality, setQuality] = React.useState(92)
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid')
  const [previewImage, setPreviewImage] = React.useState<ExtractedImage | null>(null)
  const [isDownloading, setIsDownloading] = React.useState(false)

  const { toast } = useToast()
  const {
    state,
    progress,
    images,
    extractFromPdf,
    reset: resetExtraction,
  } = useImageExtraction({
    onComplete: (imgs) => {
      toast({
        title: 'Extraction complete',
        description: `Found ${imgs.length} image${imgs.length !== 1 ? 's' : ''}`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Extraction failed',
        description: error,
        variant: 'destructive',
      })
    },
  })

  /**
   * Handle file upload
   */
  const handleFileAccepted = React.useCallback(async (files: File[]) => {
    const pdfFile = files[0]
    if (!pdfFile) return

    setFile(pdfFile)
    resetExtraction()
    setSelectedImages(new Set())

    try {
      const buffer = await pdfFile.arrayBuffer()
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise
      setPdfDoc(doc)
      setPageCount(doc.numPages)
    } catch {
      toast({
        title: 'Error reading PDF',
        description: 'Could not read the PDF file. Please try another file.',
        variant: 'destructive',
      })
      setFile(null)
      setPdfDoc(null)
    }
  }, [toast, resetExtraction])

  /**
   * Clear the selected file
   */
  const handleClearFile = React.useCallback(() => {
    setFile(null)
    setPdfDoc(null)
    setPageCount(0)
    setSelectedImages(new Set())
    setPreviewImage(null)
    resetExtraction()
  }, [resetExtraction])

  /**
   * Extract images from PDF
   */
  const handleExtract = React.useCallback(async () => {
    if (!pdfDoc) return

    await extractFromPdf(pdfDoc, {
      minWidth: minWidth > 0 ? minWidth : undefined,
      minHeight: minHeight > 0 ? minHeight : undefined,
      outputFormat: outputFormat === 'original' ? undefined : outputFormat,
      quality: quality / 100,
    })
  }, [pdfDoc, minWidth, minHeight, outputFormat, quality, extractFromPdf])

  /**
   * Toggle image selection
   */
  const toggleImageSelection = React.useCallback((index: number) => {
    setSelectedImages((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  /**
   * Select all images
   */
  const selectAllImages = React.useCallback(() => {
    setSelectedImages(new Set(images.map((_, i) => i)))
  }, [images])

  /**
   * Clear image selection
   */
  const clearImageSelection = React.useCallback(() => {
    setSelectedImages(new Set())
  }, [])

  /**
   * Get filtered images based on current filters
   */
  const filteredImages = React.useMemo(() => {
    return images.filter((img) => {
      if (minWidth > 0 && img.width < minWidth) return false
      if (minHeight > 0 && img.height < minHeight) return false
      return true
    })
  }, [images, minWidth, minHeight])

  /**
   * Create image URL for preview
   */
  const createImageUrl = React.useCallback((image: ExtractedImage): string => {
    const mimeType = image.format === 'jpeg' ? 'image/jpeg' :
                     image.format === 'webp' ? 'image/webp' :
                     'image/png'
    const blob = new Blob([new Uint8Array(image.data).buffer as ArrayBuffer], { type: mimeType })
    return URL.createObjectURL(blob)
  }, [])

  /**
   * Download a single image
   */
  const downloadImage = React.useCallback((image: ExtractedImage) => {
    const mimeType = image.format === 'jpeg' ? 'image/jpeg' :
                     image.format === 'webp' ? 'image/webp' :
                     'image/png'
    const blob = new Blob([new Uint8Array(image.data).buffer as ArrayBuffer], { type: mimeType })
    const filename = `image_page${image.page}_${image.index + 1}.${image.format}`
    downloadBlob(blob, filename)
  }, [])

  /**
   * Download images as ZIP
   */
  const downloadAsZip = React.useCallback(async (imageIndices?: Set<number>) => {
    const imagesToDownload = imageIndices
      ? images.filter((_, i) => imageIndices.has(i))
      : images

    if (imagesToDownload.length === 0) {
      toast({
        title: 'No images selected',
        description: 'Please select at least one image to download.',
        variant: 'destructive',
      })
      return
    }

    setIsDownloading(true)

    try {
      const zip = new JSZip()

      for (const img of imagesToDownload) {
        const filename = `image_page${img.page}_${img.index + 1}.${img.format}`
        zip.file(filename, img.data)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipFilename = file
        ? `${file.name.replace('.pdf', '')}_images.zip`
        : 'extracted_images.zip'
      downloadBlob(zipBlob, zipFilename)

      toast({
        title: 'Download complete',
        description: `Downloaded ${imagesToDownload.length} image${imagesToDownload.length !== 1 ? 's' : ''} as ZIP`,
      })
    } catch {
      toast({
        title: 'Download failed',
        description: 'Failed to create ZIP file.',
        variant: 'destructive',
      })
    } finally {
      setIsDownloading(false)
    }
  }, [images, file, toast])

  /**
   * Get images grouped by page
   */
  const imagesByPage = React.useMemo(() => {
    const grouped = new Map<number, ExtractedImage[]>()
    for (const img of filteredImages) {
      const pageImages = grouped.get(img.page) ?? []
      pageImages.push(img)
      grouped.set(img.page, pageImages)
    }
    return grouped
  }, [filteredImages])

  const isProcessing = state === 'extracting' || state === 'counting'
  const hasImages = images.length > 0

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5 text-purple-500" />
          Extract Images
        </CardTitle>
        <CardDescription>
          Extract all images from a PDF document.
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
              className="text-surface-400 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Extraction Options */}
        {file && pdfDoc && !hasImages && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Min Width Filter */}
              <div className="space-y-2">
                <label
                  htmlFor="min-width"
                  className="text-sm font-medium text-surface-700 dark:text-surface-300"
                >
                  Min Width (px)
                </label>
                <Input
                  id="min-width"
                  type="number"
                  min={0}
                  value={minWidth}
                  onChange={(e) => setMinWidth(parseInt(e.target.value, 10) || 0)}
                  disabled={isProcessing}
                  placeholder="0"
                />
              </div>

              {/* Min Height Filter */}
              <div className="space-y-2">
                <label
                  htmlFor="min-height"
                  className="text-sm font-medium text-surface-700 dark:text-surface-300"
                >
                  Min Height (px)
                </label>
                <Input
                  id="min-height"
                  type="number"
                  min={0}
                  value={minHeight}
                  onChange={(e) => setMinHeight(parseInt(e.target.value, 10) || 0)}
                  disabled={isProcessing}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Output Format */}
              <div className="space-y-2 relative">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Output Format
                </label>
                <Select
                  value={outputFormat}
                  onValueChange={(v) => setOutputFormat(v as OutputFormat)}
                  disabled={isProcessing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">Original</SelectItem>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="jpeg">JPEG</SelectItem>
                    <SelectItem value="webp">WebP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quality Slider */}
              {(outputFormat === 'jpeg' || outputFormat === 'webp') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Quality: {quality}%
                  </label>
                  <Slider
                    value={[quality]}
                    onValueChange={([v]) => setQuality(v ?? 92)}
                    min={10}
                    max={100}
                    step={1}
                    disabled={isProcessing}
                  />
                </div>
              )}
            </div>
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
          </div>
        )}

        {/* Extract Button */}
        {file && pdfDoc && !hasImages && (
          <Button
            onClick={handleExtract}
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Image className="h-4 w-4 mr-2" />
                Extract Images
              </>
            )}
          </Button>
        )}

        {/* Image Gallery */}
        {hasImages && (
          <div className="space-y-4">
            {/* Gallery Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-surface-600 dark:text-surface-400">
                  {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''}
                  {selectedImages.size > 0 && ` (${selectedImages.size} selected)`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllImages}
                  disabled={isDownloading}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearImageSelection}
                  disabled={selectedImages.size === 0 || isDownloading}
                >
                  Clear
                </Button>
                <div className="flex border rounded-md overflow-hidden">
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-none"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Filter by Size */}
            <div className="flex items-center gap-4 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <Filter className="h-4 w-4 text-surface-400" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-surface-600 dark:text-surface-400">Min:</span>
                <Input
                  type="number"
                  min={0}
                  value={minWidth}
                  onChange={(e) => setMinWidth(parseInt(e.target.value, 10) || 0)}
                  className="w-20 h-8"
                  placeholder="W"
                />
                <span className="text-surface-400">x</span>
                <Input
                  type="number"
                  min={0}
                  value={minHeight}
                  onChange={(e) => setMinHeight(parseInt(e.target.value, 10) || 0)}
                  className="w-20 h-8"
                  placeholder="H"
                />
                <span className="text-sm text-surface-400">px</span>
              </div>
            </div>

            {/* Image Grid/List */}
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="all">All Pages</TabsTrigger>
                {Array.from(imagesByPage.keys()).map((page) => (
                  <TabsTrigger key={page} value={`page-${page}`}>
                    Page {page}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <ImageGallery
                  images={filteredImages}
                  selectedImages={selectedImages}
                  viewMode={viewMode}
                  onToggleSelect={toggleImageSelection}
                  onPreview={setPreviewImage}
                  onDownload={downloadImage}
                  createImageUrl={createImageUrl}
                />
              </TabsContent>

              {Array.from(imagesByPage.entries()).map(([page, pageImages]) => (
                <TabsContent key={page} value={`page-${page}`} className="mt-4">
                  <ImageGallery
                    images={pageImages}
                    selectedImages={selectedImages}
                    viewMode={viewMode}
                    onToggleSelect={toggleImageSelection}
                    onPreview={setPreviewImage}
                    onDownload={downloadImage}
                    createImageUrl={createImageUrl}
                  />
                </TabsContent>
              ))}
            </Tabs>

            {/* Download Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => downloadAsZip(selectedImages.size > 0 ? selectedImages : undefined)}
                disabled={isDownloading || filteredImages.length === 0}
                className="flex-1"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating ZIP...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    {selectedImages.size > 0
                      ? `Download Selected (${selectedImages.size})`
                      : `Download All (${filteredImages.length})`}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreviewModal
          image={previewImage}
          onClose={() => setPreviewImage(null)}
          onDownload={() => downloadImage(previewImage)}
          createImageUrl={createImageUrl}
        />
      )}
    </Card>
  )
}

/**
 * Image Gallery component
 */
interface ImageGalleryProps {
  images: ExtractedImage[]
  selectedImages: Set<number>
  viewMode: ViewMode
  onToggleSelect: (index: number) => void
  onPreview: (image: ExtractedImage) => void
  onDownload: (image: ExtractedImage) => void
  createImageUrl: (image: ExtractedImage) => string
}

function ImageGallery({
  images,
  selectedImages,
  viewMode,
  onToggleSelect,
  onPreview,
  onDownload,
  createImageUrl,
}: ImageGalleryProps) {
  const [imageUrls, setImageUrls] = React.useState<Map<number, string>>(new Map())

  // Create URLs for visible images
  React.useEffect(() => {
    const urls = new Map<number, string>()
    for (const img of images) {
      urls.set(img.index, createImageUrl(img))
    }
    setImageUrls(urls)

    // Cleanup URLs on unmount
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [images, createImageUrl])

  if (images.length === 0) {
    return (
      <div className="text-center py-8 text-surface-500">
        No images match the current filters.
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {images.map((img) => (
          <div
            key={img.index}
            className={cn(
              'flex items-center gap-4 p-3 rounded-lg border transition-colors cursor-pointer',
              selectedImages.has(img.index)
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
            )}
            onClick={() => onToggleSelect(img.index)}
          >
            <div className="flex-shrink-0 w-16 h-16 bg-surface-100 dark:bg-surface-800 rounded overflow-hidden">
              <img
                src={imageUrls.get(img.index) ?? ''}
                alt={`Image ${img.index + 1}`}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900 dark:text-white">
                Image {img.index + 1}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Page {img.page} - {img.width} x {img.height} - {img.format.toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onPreview(img)
                }}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onDownload(img)
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
              <div
                className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center',
                  selectedImages.has(img.index)
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-surface-300 dark:border-surface-600'
                )}
              >
                {selectedImages.has(img.index) && (
                  <Check className="h-3 w-3 text-white" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[500px] overflow-y-auto p-2">
      {images.map((img) => (
        <div
          key={img.index}
          className={cn(
            'relative group rounded-lg border overflow-hidden cursor-pointer transition-all',
            selectedImages.has(img.index)
              ? 'border-primary-500 ring-2 ring-primary-500/20'
              : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
          )}
          onClick={() => onToggleSelect(img.index)}
        >
          <div className="aspect-square bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
            <img
              src={imageUrls.get(img.index) ?? ''}
              alt={`Image ${img.index + 1}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Selection checkbox */}
          <div
            className={cn(
              'absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center bg-white dark:bg-surface-900 transition-opacity',
              selectedImages.has(img.index)
                ? 'border-primary-500 bg-primary-500 dark:bg-primary-500 opacity-100'
                : 'border-surface-300 dark:border-surface-600 opacity-0 group-hover:opacity-100'
            )}
          >
            {selectedImages.has(img.index) && (
              <Check className="h-3 w-3 text-white" />
            )}
          </div>

          {/* Hover actions */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="secondary"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                onPreview(img)
              }}
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                onDownload(img)
              }}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>

          {/* Image info */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
            <p className="text-xs text-white truncate">
              {img.width} x {img.height}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Image Preview Modal component
 */
interface ImagePreviewModalProps {
  image: ExtractedImage
  onClose: () => void
  onDownload: () => void
  createImageUrl: (image: ExtractedImage) => string
}

function ImagePreviewModal({
  image,
  onClose,
  onDownload,
  createImageUrl,
}: ImagePreviewModalProps) {
  const [imageUrl, setImageUrl] = React.useState<string>('')

  React.useEffect(() => {
    const url = createImageUrl(image)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image, createImageUrl])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-surface-900 rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <div>
            <h3 className="font-medium text-surface-900 dark:text-white">
              Image {image.index + 1}
            </h3>
            <p className="text-sm text-surface-500">
              Page {image.page} - {image.width} x {image.height} - {image.format.toUpperCase()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
          <img
            src={imageUrl}
            alt={`Image ${image.index + 1}`}
            className="max-w-full h-auto mx-auto"
          />
        </div>
      </div>
    </div>
  )
}
