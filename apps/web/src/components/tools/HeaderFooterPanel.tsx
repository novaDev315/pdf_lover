/**
 * HeaderFooterPanel - PDF header and footer tools component
 * Allows users to add headers and footers to PDFs
 */

import * as React from 'react'
import {
  FileText,
  Image,
  Loader2,
  Download,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { useToast } from '@/hooks/use-toast'
import {
  cn,
  formatFileSize,
  downloadBlob,
  arrayBufferToBlob,
  readFileAsDataURL,
} from '@/lib/utils'
import {
  addHeader,
  addFooter,
  type StandardFontName,
  STANDARD_FONTS,
} from '@pdflover/pdf-core'
import type { ProgressInfo } from '@pdflover/shared'

/**
 * Alignment selector component
 */
interface AlignmentSelectorProps {
  selected: 'left' | 'center' | 'right'
  onChange: (alignment: 'left' | 'center' | 'right') => void
  disabled?: boolean
}

function AlignmentSelector({ selected, onChange, disabled }: AlignmentSelectorProps) {
  const alignments: { value: 'left' | 'center' | 'right'; icon: React.ElementType; label: string }[] = [
    { value: 'left', icon: AlignLeft, label: 'Left' },
    { value: 'center', icon: AlignCenter, label: 'Center' },
    { value: 'right', icon: AlignRight, label: 'Right' },
  ]

  return (
    <div className="flex gap-2">
      {alignments.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          disabled={disabled}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
            selected === value
              ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/20 dark:text-primary-300'
              : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * Page preview component showing header/footer placement
 */
interface PagePreviewProps {
  headerText?: string
  footerText?: string
  headerAlignment: 'left' | 'center' | 'right'
  footerAlignment: 'left' | 'center' | 'right'
  headerImage?: string | null
  footerImage?: string | null
}

function PagePreview({
  headerText,
  footerText,
  headerAlignment,
  footerAlignment,
  headerImage,
  footerImage,
}: PagePreviewProps) {
  const alignClass = {
    left: 'text-left justify-start',
    center: 'text-center justify-center',
    right: 'text-right justify-end',
  }

  return (
    <div className="border border-surface-200 dark:border-surface-700 rounded-lg p-4 bg-surface-50 dark:bg-surface-900">
      <div className="text-xs text-center text-surface-500 mb-2">Page Preview</div>
      <div className="aspect-[8.5/11] border border-dashed border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 relative overflow-hidden">
        {/* Header area */}
        <div className={cn('absolute top-3 left-3 right-3 flex items-center', alignClass[headerAlignment])}>
          {headerImage ? (
            <img src={headerImage} alt="Header" className="h-4 object-contain" />
          ) : headerText ? (
            <span className="text-[8px] text-surface-600 dark:text-surface-400 truncate max-w-full">
              {headerText.replace(/\{page\}/g, '1').replace(/\{total\}/g, '10').replace(/\{date\}/g, new Date().toLocaleDateString())}
            </span>
          ) : (
            <span className="text-[8px] text-surface-400 italic">Header</span>
          )}
        </div>

        {/* Page content area */}
        <div className="absolute inset-8 flex items-center justify-center">
          <div className="w-full space-y-1">
            <div className="h-1 bg-surface-200 dark:bg-surface-700 rounded" />
            <div className="h-1 bg-surface-200 dark:bg-surface-700 rounded w-4/5" />
            <div className="h-1 bg-surface-200 dark:bg-surface-700 rounded w-3/4" />
            <div className="h-1 bg-surface-200 dark:bg-surface-700 rounded w-5/6" />
          </div>
        </div>

        {/* Footer area */}
        <div className={cn('absolute bottom-3 left-3 right-3 flex items-center', alignClass[footerAlignment])}>
          {footerImage ? (
            <img src={footerImage} alt="Footer" className="h-4 object-contain" />
          ) : footerText ? (
            <span className="text-[8px] text-surface-600 dark:text-surface-400 truncate max-w-full">
              {footerText.replace(/\{page\}/g, '1').replace(/\{total\}/g, '10').replace(/\{date\}/g, new Date().toLocaleDateString())}
            </span>
          ) : (
            <span className="text-[8px] text-surface-400 italic">Footer</span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Placeholder help text component
 */
function PlaceholderHelp() {
  return (
    <div className="text-xs text-surface-500 space-y-1">
      <p>Available placeholders:</p>
      <ul className="list-disc list-inside pl-2 space-y-0.5">
        <li><code className="px-1 bg-surface-100 dark:bg-surface-800 rounded">{'{page}'}</code> - Current page number</li>
        <li><code className="px-1 bg-surface-100 dark:bg-surface-800 rounded">{'{total}'}</code> - Total page count</li>
        <li><code className="px-1 bg-surface-100 dark:bg-surface-800 rounded">{'{date}'}</code> - Current date</li>
      </ul>
    </div>
  )
}

/**
 * Props for HeaderFooterPanel component
 */
export interface HeaderFooterPanelProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * PDF Header/Footer Panel component
 *
 * Features:
 * - Text headers/footers with placeholder support
 * - Image headers/footers
 * - Position and alignment controls
 * - Different odd/even page content
 * - Font, size, color customization
 */
export function HeaderFooterPanel({ className }: HeaderFooterPanelProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const [activeTab, setActiveTab] = React.useState('header')
  const { toast } = useToast()

  // Header settings
  const [headerText, setHeaderText] = React.useState('')
  const [headerImage, setHeaderImage] = React.useState<string | null>(null)
  const [headerPosition, setHeaderPosition] = React.useState<'left' | 'center' | 'right'>('center')
  const [headerFont, setHeaderFont] = React.useState<StandardFontName>('Helvetica')
  const [headerFontSize, setHeaderFontSize] = React.useState(10)
  const [headerColor, setHeaderColor] = React.useState('#000000')
  const [headerMargin, setHeaderMargin] = React.useState(36)
  const [headerOddText, setHeaderOddText] = React.useState('')
  const [headerEvenText, setHeaderEvenText] = React.useState('')
  const [headerUseDifferentPages, setHeaderUseDifferentPages] = React.useState(false)
  const [headerImageScale, setHeaderImageScale] = React.useState(50)

  // Footer settings
  const [footerText, setFooterText] = React.useState('')
  const [footerImage, setFooterImage] = React.useState<string | null>(null)
  const [footerPosition, setFooterPosition] = React.useState<'left' | 'center' | 'right'>('center')
  const [footerFont, setFooterFont] = React.useState<StandardFontName>('Helvetica')
  const [footerFontSize, setFooterFontSize] = React.useState(10)
  const [footerColor, setFooterColor] = React.useState('#000000')
  const [footerMargin, setFooterMargin] = React.useState(36)
  const [footerOddText, setFooterOddText] = React.useState('')
  const [footerEvenText, setFooterEvenText] = React.useState('')
  const [footerUseDifferentPages, setFooterUseDifferentPages] = React.useState(false)
  const [footerImageScale, setFooterImageScale] = React.useState(50)

  /**
   * Handle PDF file selection
   */
  const handleFilesAccepted = React.useCallback(
    (acceptedFiles: File[]) => {
      const selectedFile = acceptedFiles[0]
      if (!selectedFile) return

      setFile(selectedFile)
      toast({
        title: 'File selected',
        description: `Ready to add headers/footers to ${selectedFile.name}`,
      })
    },
    [toast]
  )

  /**
   * Handle header image selection
   */
  const handleHeaderImageSelected = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (!selectedFile) return

      try {
        const dataUrl = await readFileAsDataURL(selectedFile)
        setHeaderImage(dataUrl)
        toast({
          title: 'Image loaded',
          description: 'Header image ready to apply',
        })
      } catch {
        toast({
          title: 'Failed to load image',
          description: 'Please try a different image file',
          variant: 'destructive',
        })
      }
    },
    [toast]
  )

  /**
   * Handle footer image selection
   */
  const handleFooterImageSelected = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (!selectedFile) return

      try {
        const dataUrl = await readFileAsDataURL(selectedFile)
        setFooterImage(dataUrl)
        toast({
          title: 'Image loaded',
          description: 'Footer image ready to apply',
        })
      } catch {
        toast({
          title: 'Failed to load image',
          description: 'Please try a different image file',
          variant: 'destructive',
        })
      }
    },
    [toast]
  )

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
   * Apply header
   */
  const handleApplyHeader = React.useCallback(async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a PDF file first',
        variant: 'destructive',
      })
      return
    }

    if (!headerText && !headerImage) {
      toast({
        title: 'No header content',
        description: 'Please enter header text or select an image',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting...')

    try {
      const buffer = await file.arrayBuffer()
      const result = await addHeader({
        document: buffer,
        text: headerText || undefined,
        image: headerImage || undefined,
        position: headerPosition,
        font: headerFont,
        fontSize: headerFontSize,
        color: headerColor,
        margin: headerMargin,
        oddPageText: headerUseDifferentPages && headerOddText ? headerOddText : undefined,
        evenPageText: headerUseDifferentPages && headerEvenText ? headerEvenText : undefined,
        imageScale: headerImageScale / 100,
        onProgress: handleProgress,
      })

      if (result.success && result.data) {
        const blob = arrayBufferToBlob(result.data, 'application/pdf')
        const filename = file.name.replace('.pdf', '_with_header.pdf')
        downloadBlob(blob, filename)

        toast({
          title: 'Header added',
          description: `Successfully added header to ${file.name}`,
        })
      } else {
        throw new Error(result.error ?? 'Failed to add header')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Operation failed',
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
    headerText,
    headerImage,
    headerPosition,
    headerFont,
    headerFontSize,
    headerColor,
    headerMargin,
    headerUseDifferentPages,
    headerOddText,
    headerEvenText,
    headerImageScale,
    handleProgress,
    toast,
  ])

  /**
   * Apply footer
   */
  const handleApplyFooter = React.useCallback(async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a PDF file first',
        variant: 'destructive',
      })
      return
    }

    if (!footerText && !footerImage) {
      toast({
        title: 'No footer content',
        description: 'Please enter footer text or select an image',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting...')

    try {
      const buffer = await file.arrayBuffer()
      const result = await addFooter({
        document: buffer,
        text: footerText || undefined,
        image: footerImage || undefined,
        position: footerPosition,
        font: footerFont,
        fontSize: footerFontSize,
        color: footerColor,
        margin: footerMargin,
        oddPageText: footerUseDifferentPages && footerOddText ? footerOddText : undefined,
        evenPageText: footerUseDifferentPages && footerEvenText ? footerEvenText : undefined,
        imageScale: footerImageScale / 100,
        onProgress: handleProgress,
      })

      if (result.success && result.data) {
        const blob = arrayBufferToBlob(result.data, 'application/pdf')
        const filename = file.name.replace('.pdf', '_with_footer.pdf')
        downloadBlob(blob, filename)

        toast({
          title: 'Footer added',
          description: `Successfully added footer to ${file.name}`,
        })
      } else {
        throw new Error(result.error ?? 'Failed to add footer')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Operation failed',
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
    footerText,
    footerImage,
    footerPosition,
    footerFont,
    footerFontSize,
    footerColor,
    footerMargin,
    footerUseDifferentPages,
    footerOddText,
    footerEvenText,
    footerImageScale,
    handleProgress,
    toast,
  ])

  /**
   * Apply both header and footer
   */
  const handleApplyBoth = React.useCallback(async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a PDF file first',
        variant: 'destructive',
      })
      return
    }

    const hasHeader = headerText || headerImage
    const hasFooter = footerText || footerImage

    if (!hasHeader && !hasFooter) {
      toast({
        title: 'No content',
        description: 'Please add header or footer content',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting...')

    try {
      let buffer = await file.arrayBuffer()

      // Apply header first if present
      if (hasHeader) {
        setProgressStage('Adding header...')
        const headerResult = await addHeader({
          document: buffer,
          text: headerText || undefined,
          image: headerImage || undefined,
          position: headerPosition,
          font: headerFont,
          fontSize: headerFontSize,
          color: headerColor,
          margin: headerMargin,
          oddPageText: headerUseDifferentPages && headerOddText ? headerOddText : undefined,
          evenPageText: headerUseDifferentPages && headerEvenText ? headerEvenText : undefined,
          imageScale: headerImageScale / 100,
          onProgress: (info) => handleProgress({ ...info, percentage: info.percentage / 2 }),
        })

        if (!headerResult.success || !headerResult.data) {
          throw new Error(headerResult.error ?? 'Failed to add header')
        }

        buffer = headerResult.data
      }

      // Apply footer if present
      if (hasFooter) {
        setProgressStage('Adding footer...')
        const footerResult = await addFooter({
          document: buffer,
          text: footerText || undefined,
          image: footerImage || undefined,
          position: footerPosition,
          font: footerFont,
          fontSize: footerFontSize,
          color: footerColor,
          margin: footerMargin,
          oddPageText: footerUseDifferentPages && footerOddText ? footerOddText : undefined,
          evenPageText: footerUseDifferentPages && footerEvenText ? footerEvenText : undefined,
          imageScale: footerImageScale / 100,
          onProgress: (info) => handleProgress({ ...info, percentage: 50 + info.percentage / 2 }),
        })

        if (!footerResult.success || !footerResult.data) {
          throw new Error(footerResult.error ?? 'Failed to add footer')
        }

        buffer = footerResult.data
      }

      const blob = arrayBufferToBlob(buffer, 'application/pdf')
      const filename = file.name.replace('.pdf', '_with_header_footer.pdf')
      downloadBlob(blob, filename)

      toast({
        title: 'Header and footer added',
        description: `Successfully added header and footer to ${file.name}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Operation failed',
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
    headerText,
    headerImage,
    headerPosition,
    headerFont,
    headerFontSize,
    headerColor,
    headerMargin,
    headerUseDifferentPages,
    headerOddText,
    headerEvenText,
    headerImageScale,
    footerText,
    footerImage,
    footerPosition,
    footerFont,
    footerFontSize,
    footerColor,
    footerMargin,
    footerUseDifferentPages,
    footerOddText,
    footerEvenText,
    footerImageScale,
    handleProgress,
    toast,
  ])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-green-500" />
          Add Header & Footer
        </CardTitle>
        <CardDescription>
          Add headers and footers to your PDF documents with text or images.
          All processing happens locally in your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* PDF File Dropzone */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Select PDF
          </label>
          <FileDropzone
            onFilesAccepted={handleFilesAccepted}
            multiple={false}
            maxFiles={1}
            disabled={isProcessing}
          />
        </div>

        {/* Selected File Info */}
        {file && (
          <div className="flex items-center gap-3 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
            <FileText className="h-5 w-5 text-surface-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                {file.name}
              </p>
              <p className="text-xs text-surface-500">{formatFileSize(file.size)}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFile(null)}
              disabled={isProcessing}
            >
              Change
            </Button>
          </div>
        )}

        {/* Page Preview */}
        <PagePreview
          headerText={headerText}
          footerText={footerText}
          headerAlignment={headerPosition}
          footerAlignment={footerPosition}
          headerImage={headerImage}
          footerImage={footerImage}
        />

        {/* Header/Footer Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="header">Header</TabsTrigger>
            <TabsTrigger value="footer">Footer</TabsTrigger>
          </TabsList>

          {/* Header Tab */}
          <TabsContent value="header" className="space-y-4 mt-4">
            {/* Header Text */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Header Text
              </label>
              <Input
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Document Title - Page {page} of {total}"
                disabled={isProcessing}
              />
              <PlaceholderHelp />
            </div>

            {/* Header Image */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Header Image (optional)
              </label>
              {headerImage ? (
                <div className="flex items-center gap-3 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
                  <img
                    src={headerImage}
                    alt="Header preview"
                    className="w-16 h-8 object-contain rounded"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">
                      Image loaded
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHeaderImage(null)}
                    disabled={isProcessing}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleHeaderImageSelected}
                    disabled={isProcessing}
                    className="hidden"
                    id="header-image-input"
                  />
                  <label
                    htmlFor="header-image-input"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Image className="h-6 w-6 text-surface-400 mb-1" />
                    <p className="text-sm text-surface-600 dark:text-surface-400">
                      Click to upload header image
                    </p>
                  </label>
                </div>
              )}
            </div>

            {/* Image Scale */}
            {headerImage && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Image Scale
                  </label>
                  <span className="text-sm text-surface-500">{headerImageScale}%</span>
                </div>
                <Slider
                  value={[headerImageScale]}
                  onValueChange={(value) => setHeaderImageScale(value[0] ?? 50)}
                  min={10}
                  max={100}
                  step={5}
                  disabled={isProcessing}
                />
              </div>
            )}

            {/* Alignment */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Alignment
              </label>
              <AlignmentSelector
                selected={headerPosition}
                onChange={setHeaderPosition}
                disabled={isProcessing}
              />
            </div>

            {/* Different Odd/Even Pages */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={headerUseDifferentPages}
                onChange={(e) => setHeaderUseDifferentPages(e.target.checked)}
                disabled={isProcessing}
                className="h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
              />
              <div>
                <p className="text-sm font-medium text-surface-900 dark:text-white">
                  Different odd/even pages
                </p>
                <p className="text-xs text-surface-500">
                  Use different header text for odd and even pages
                </p>
              </div>
            </label>

            {headerUseDifferentPages && (
              <div className="grid grid-cols-2 gap-4 pl-7">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Odd Pages
                  </label>
                  <Input
                    value={headerOddText}
                    onChange={(e) => setHeaderOddText(e.target.value)}
                    placeholder="Odd page header"
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Even Pages
                  </label>
                  <Input
                    value={headerEvenText}
                    onChange={(e) => setHeaderEvenText(e.target.value)}
                    placeholder="Even page header"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            )}

            {/* Font Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Font
                </label>
                <Select
                  value={headerFont}
                  onValueChange={(value) => setHeaderFont(value as StandardFontName)}
                  disabled={isProcessing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent>
                    {STANDARD_FONTS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={headerColor}
                    onChange={(e) => setHeaderColor(e.target.value)}
                    disabled={isProcessing}
                    className="w-10 h-10 rounded border border-surface-200 dark:border-surface-700 cursor-pointer"
                  />
                  <Input
                    value={headerColor}
                    onChange={(e) => setHeaderColor(e.target.value)}
                    disabled={isProcessing}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Font Size
                </label>
                <span className="text-sm text-surface-500">{headerFontSize}pt</span>
              </div>
              <Slider
                value={[headerFontSize]}
                onValueChange={(value) => setHeaderFontSize(value[0] ?? 10)}
                min={6}
                max={18}
                step={1}
                disabled={isProcessing}
              />
            </div>

            {/* Margin */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Margin from Edge
                </label>
                <span className="text-sm text-surface-500">{headerMargin}pt</span>
              </div>
              <Slider
                value={[headerMargin]}
                onValueChange={(value) => setHeaderMargin(value[0] ?? 36)}
                min={18}
                max={72}
                step={6}
                disabled={isProcessing}
              />
            </div>

            {/* Apply Header Button */}
            <Button
              onClick={handleApplyHeader}
              disabled={!file || (!headerText && !headerImage) || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Add Header Only
                </>
              )}
            </Button>
          </TabsContent>

          {/* Footer Tab */}
          <TabsContent value="footer" className="space-y-4 mt-4">
            {/* Footer Text */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Footer Text
              </label>
              <Input
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Page {page} of {total} - {date}"
                disabled={isProcessing}
              />
              <PlaceholderHelp />
            </div>

            {/* Footer Image */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Footer Image (optional)
              </label>
              {footerImage ? (
                <div className="flex items-center gap-3 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
                  <img
                    src={footerImage}
                    alt="Footer preview"
                    className="w-16 h-8 object-contain rounded"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">
                      Image loaded
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFooterImage(null)}
                    disabled={isProcessing}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleFooterImageSelected}
                    disabled={isProcessing}
                    className="hidden"
                    id="footer-image-input"
                  />
                  <label
                    htmlFor="footer-image-input"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Image className="h-6 w-6 text-surface-400 mb-1" />
                    <p className="text-sm text-surface-600 dark:text-surface-400">
                      Click to upload footer image
                    </p>
                  </label>
                </div>
              )}
            </div>

            {/* Image Scale */}
            {footerImage && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Image Scale
                  </label>
                  <span className="text-sm text-surface-500">{footerImageScale}%</span>
                </div>
                <Slider
                  value={[footerImageScale]}
                  onValueChange={(value) => setFooterImageScale(value[0] ?? 50)}
                  min={10}
                  max={100}
                  step={5}
                  disabled={isProcessing}
                />
              </div>
            )}

            {/* Alignment */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Alignment
              </label>
              <AlignmentSelector
                selected={footerPosition}
                onChange={setFooterPosition}
                disabled={isProcessing}
              />
            </div>

            {/* Different Odd/Even Pages */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={footerUseDifferentPages}
                onChange={(e) => setFooterUseDifferentPages(e.target.checked)}
                disabled={isProcessing}
                className="h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
              />
              <div>
                <p className="text-sm font-medium text-surface-900 dark:text-white">
                  Different odd/even pages
                </p>
                <p className="text-xs text-surface-500">
                  Use different footer text for odd and even pages
                </p>
              </div>
            </label>

            {footerUseDifferentPages && (
              <div className="grid grid-cols-2 gap-4 pl-7">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Odd Pages
                  </label>
                  <Input
                    value={footerOddText}
                    onChange={(e) => setFooterOddText(e.target.value)}
                    placeholder="Odd page footer"
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Even Pages
                  </label>
                  <Input
                    value={footerEvenText}
                    onChange={(e) => setFooterEvenText(e.target.value)}
                    placeholder="Even page footer"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            )}

            {/* Font Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Font
                </label>
                <Select
                  value={footerFont}
                  onValueChange={(value) => setFooterFont(value as StandardFontName)}
                  disabled={isProcessing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent>
                    {STANDARD_FONTS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={footerColor}
                    onChange={(e) => setFooterColor(e.target.value)}
                    disabled={isProcessing}
                    className="w-10 h-10 rounded border border-surface-200 dark:border-surface-700 cursor-pointer"
                  />
                  <Input
                    value={footerColor}
                    onChange={(e) => setFooterColor(e.target.value)}
                    disabled={isProcessing}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Font Size
                </label>
                <span className="text-sm text-surface-500">{footerFontSize}pt</span>
              </div>
              <Slider
                value={[footerFontSize]}
                onValueChange={(value) => setFooterFontSize(value[0] ?? 10)}
                min={6}
                max={18}
                step={1}
                disabled={isProcessing}
              />
            </div>

            {/* Margin */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Margin from Edge
                </label>
                <span className="text-sm text-surface-500">{footerMargin}pt</span>
              </div>
              <Slider
                value={[footerMargin]}
                onValueChange={(value) => setFooterMargin(value[0] ?? 36)}
                min={18}
                max={72}
                step={6}
                disabled={isProcessing}
              />
            </div>

            {/* Apply Footer Button */}
            <Button
              onClick={handleApplyFooter}
              disabled={!file || (!footerText && !footerImage) || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Add Footer Only
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {/* Apply Both Button */}
        <Button
          onClick={handleApplyBoth}
          disabled={!file || ((!headerText && !headerImage) && (!footerText && !footerImage)) || isProcessing}
          variant="default"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Add Header & Footer
            </>
          )}
        </Button>

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
      </CardContent>
    </Card>
  )
}
