/**
 * PageNumbersPanel - PDF page numbering tools component
 * Allows users to add page numbers and Bates numbering to PDFs
 */

import * as React from 'react'
import {
  Hash,
  Loader2,
  Download,
  Settings2,
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
} from '@/lib/utils'
import {
  addPageNumbers,
  addBatesNumbering,
  type PageElementPosition,
  type PageNumberFormat,
  type StandardFontName,
  STANDARD_FONTS,
  PAGE_NUMBER_FORMATS,
  POSITION_LABELS,
} from '@pdflover/pdf-core'
import type { ProgressInfo } from '@pdflover/shared'

/**
 * Position selector grid component
 */
interface PositionGridProps {
  selected: PageElementPosition
  onChange: (position: PageElementPosition) => void
  disabled?: boolean
}

function PositionGrid({ selected, onChange, disabled }: PositionGridProps) {
  const positions: PageElementPosition[][] = [
    ['top-left', 'top-center', 'top-right'],
    ['bottom-left', 'bottom-center', 'bottom-right'],
  ]

  return (
    <div className="border border-surface-200 dark:border-surface-700 rounded-lg p-4 bg-surface-50 dark:bg-surface-900">
      <div className="text-xs text-center text-surface-500 mb-2">Page Preview</div>
      <div className="aspect-[8.5/11] border border-dashed border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 relative">
        {/* Top row */}
        <div className="absolute top-2 left-0 right-0 flex justify-between px-2">
          {positions[0]!.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => onChange(pos)}
              disabled={disabled}
              className={cn(
                'w-8 h-6 rounded text-[8px] font-medium transition-all',
                selected === pos
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {selected === pos ? '#' : ''}
            </button>
          ))}
        </div>

        {/* Page content area indicator */}
        <div className="absolute inset-8 flex items-center justify-center">
          <div className="text-[10px] text-surface-400">Document Content</div>
        </div>

        {/* Bottom row */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-between px-2">
          {positions[1]!.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => onChange(pos)}
              disabled={disabled}
              className={cn(
                'w-8 h-6 rounded text-[8px] font-medium transition-all',
                selected === pos
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {selected === pos ? '#' : ''}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs text-center text-surface-500 mt-2">
        {POSITION_LABELS[selected]}
      </div>
    </div>
  )
}

/**
 * Format preview component
 */
interface FormatPreviewProps {
  format: PageNumberFormat
  customFormat?: string
  startNumber: number
}

function FormatPreview({ format, customFormat, startNumber }: FormatPreviewProps) {
  const previewText = React.useMemo(() => {
    switch (format) {
      case 'page-x':
        return `Page ${startNumber}`
      case 'x-of-y':
        return `${startNumber} of 10`
      case 'x-slash-y':
        return `${startNumber}/10`
      case 'x-only':
        return `${startNumber}`
      case 'custom':
        return customFormat
          ?.replace(/\{page\}/g, String(startNumber))
          .replace(/\{total\}/g, '10') ?? `${startNumber}`
      default:
        return `${startNumber}`
    }
  }, [format, customFormat, startNumber])

  return (
    <div className="px-4 py-3 bg-surface-100 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
      <div className="text-xs text-surface-500 mb-1">Preview</div>
      <div className="text-lg font-medium text-surface-900 dark:text-white">
        {previewText}
      </div>
    </div>
  )
}

/**
 * Props for PageNumbersPanel component
 */
export interface PageNumbersPanelProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * PDF Page Numbers Panel component
 *
 * Features:
 * - Multiple page number formats
 * - Position selection with visual preview
 * - Bates numbering for legal documents
 * - Font, size, color customization
 * - Page range selection
 */
export function PageNumbersPanel({ className }: PageNumbersPanelProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const [activeTab, setActiveTab] = React.useState('standard')
  const { toast } = useToast()

  // Standard page number settings
  const [position, setPosition] = React.useState<PageElementPosition>('bottom-center')
  const [format, setFormat] = React.useState<PageNumberFormat>('x-of-y')
  const [customFormat, setCustomFormat] = React.useState('{page} of {total}')
  const [startPage, setStartPage] = React.useState(1)
  const [endPage, setEndPage] = React.useState<number | undefined>(undefined)
  const [startNumber, setStartNumber] = React.useState(1)
  const [font, setFont] = React.useState<StandardFontName>('Helvetica')
  const [fontSize, setFontSize] = React.useState(12)
  const [color, setColor] = React.useState('#000000')
  const [margin, setMargin] = React.useState(36)

  // Bates numbering settings
  const [batesPrefix, setBatesPrefix] = React.useState('')
  const [batesSuffix, setBatesSuffix] = React.useState('')
  const [batesStartNumber, setBatesStartNumber] = React.useState(1)
  const [batesDigits, setBatesDigits] = React.useState(6)
  const [batesPosition, setBatesPosition] = React.useState<PageElementPosition>('bottom-right')
  const [batesFont, setBatesFont] = React.useState<StandardFontName>('Courier')
  const [batesFontSize, setBatesFontSize] = React.useState(10)
  const [batesColor, setBatesColor] = React.useState('#000000')

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
        description: `Ready to add page numbers to ${selectedFile.name}`,
      })
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
   * Apply standard page numbers
   */
  const handleApplyPageNumbers = React.useCallback(async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a PDF file first',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting...')

    try {
      const buffer = await file.arrayBuffer()
      const result = await addPageNumbers({
        document: buffer,
        position,
        format,
        customFormat: format === 'custom' ? customFormat : undefined,
        startPage,
        endPage,
        startNumber,
        font,
        fontSize,
        color,
        margin,
        onProgress: handleProgress,
      })

      if (result.success && result.data) {
        const blob = arrayBufferToBlob(result.data, 'application/pdf')
        const filename = file.name.replace('.pdf', '_numbered.pdf')
        downloadBlob(blob, filename)

        toast({
          title: 'Page numbers added',
          description: `Successfully numbered ${file.name}`,
        })
      } else {
        throw new Error(result.error ?? 'Failed to add page numbers')
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
    position,
    format,
    customFormat,
    startPage,
    endPage,
    startNumber,
    font,
    fontSize,
    color,
    margin,
    handleProgress,
    toast,
  ])

  /**
   * Apply Bates numbering
   */
  const handleApplyBatesNumbers = React.useCallback(async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a PDF file first',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting...')

    try {
      const buffer = await file.arrayBuffer()
      const result = await addBatesNumbering({
        document: buffer,
        prefix: batesPrefix,
        suffix: batesSuffix,
        startNumber: batesStartNumber,
        digits: batesDigits,
        position: batesPosition,
        font: batesFont,
        fontSize: batesFontSize,
        color: batesColor,
        margin,
        onProgress: handleProgress,
      })

      if (result.success && result.data) {
        const blob = arrayBufferToBlob(result.data, 'application/pdf')
        const filename = file.name.replace('.pdf', '_bates.pdf')
        downloadBlob(blob, filename)

        toast({
          title: 'Bates numbers added',
          description: `Successfully added Bates numbering to ${file.name}`,
        })
      } else {
        throw new Error(result.error ?? 'Failed to add Bates numbers')
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
    batesPrefix,
    batesSuffix,
    batesStartNumber,
    batesDigits,
    batesPosition,
    batesFont,
    batesFontSize,
    batesColor,
    margin,
    handleProgress,
    toast,
  ])

  // Bates preview text
  const batesPreviewText = React.useMemo(() => {
    const paddedNum = String(batesStartNumber).padStart(batesDigits, '0')
    return `${batesPrefix}${paddedNum}${batesSuffix}`
  }, [batesPrefix, batesSuffix, batesStartNumber, batesDigits])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-blue-500" />
          Add Page Numbers
        </CardTitle>
        <CardDescription>
          Add page numbers or Bates numbering to your PDF documents.
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
            <Hash className="h-5 w-5 text-surface-500" />
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

        {/* Numbering Type Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="standard" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Page Numbers
            </TabsTrigger>
            <TabsTrigger value="bates" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Bates Numbering
            </TabsTrigger>
          </TabsList>

          {/* Standard Page Numbers Tab */}
          <TabsContent value="standard" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Position Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Position
                </label>
                <PositionGrid
                  selected={position}
                  onChange={setPosition}
                  disabled={isProcessing}
                />
              </div>

              {/* Format and Preview */}
              <div className="space-y-4">
                {/* Format Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Format
                  </label>
                  <Select
                    value={format}
                    onValueChange={(value) => setFormat(value as PageNumberFormat)}
                    disabled={isProcessing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_NUMBER_FORMATS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          <span className="flex items-center gap-2">
                            <span>{f.label}</span>
                            <span className="text-surface-500 text-xs">({f.example})</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Format Input */}
                {format === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                      Custom Format
                    </label>
                    <Input
                      value={customFormat}
                      onChange={(e) => setCustomFormat(e.target.value)}
                      placeholder="Page {page} of {total}"
                      disabled={isProcessing}
                    />
                    <p className="text-xs text-surface-500">
                      Use {'{page}'} for current page, {'{total}'} for total pages
                    </p>
                  </div>
                )}

                {/* Preview */}
                <FormatPreview
                  format={format}
                  customFormat={customFormat}
                  startNumber={startNumber}
                />
              </div>
            </div>

            {/* Page Range */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Start Page
                </label>
                <Input
                  type="number"
                  min={1}
                  value={startPage}
                  onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  End Page
                </label>
                <Input
                  type="number"
                  min={1}
                  value={endPage ?? ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    setEndPage(val > 0 ? val : undefined)
                  }}
                  placeholder="All"
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Start Number
                </label>
                <Input
                  type="number"
                  min={1}
                  value={startNumber}
                  onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Font Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Font
                </label>
                <Select
                  value={font}
                  onValueChange={(value) => setFont(value as StandardFontName)}
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
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    disabled={isProcessing}
                    className="w-10 h-10 rounded border border-surface-200 dark:border-surface-700 cursor-pointer"
                  />
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    disabled={isProcessing}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Font Size Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Font Size
                </label>
                <span className="text-sm text-surface-500">{fontSize}pt</span>
              </div>
              <Slider
                value={[fontSize]}
                onValueChange={(value) => setFontSize(value[0] ?? 12)}
                min={6}
                max={24}
                step={1}
                disabled={isProcessing}
              />
            </div>

            {/* Margin Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Margin from Edge
                </label>
                <span className="text-sm text-surface-500">{margin}pt</span>
              </div>
              <Slider
                value={[margin]}
                onValueChange={(value) => setMargin(value[0] ?? 36)}
                min={18}
                max={72}
                step={6}
                disabled={isProcessing}
              />
            </div>

            {/* Apply Button */}
            <Button
              onClick={handleApplyPageNumbers}
              disabled={!file || isProcessing}
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
                  Add Page Numbers
                </>
              )}
            </Button>
          </TabsContent>

          {/* Bates Numbering Tab */}
          <TabsContent value="bates" className="space-y-4 mt-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Bates Numbering</strong> is a legal industry method for indexing documents.
                Each page receives a unique identifier for easy reference in legal proceedings.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Position Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Position
                </label>
                <PositionGrid
                  selected={batesPosition}
                  onChange={setBatesPosition}
                  disabled={isProcessing}
                />
              </div>

              {/* Bates Settings */}
              <div className="space-y-4">
                {/* Prefix */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Prefix
                  </label>
                  <Input
                    value={batesPrefix}
                    onChange={(e) => setBatesPrefix(e.target.value)}
                    placeholder="ABC-"
                    disabled={isProcessing}
                  />
                </div>

                {/* Suffix */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Suffix
                  </label>
                  <Input
                    value={batesSuffix}
                    onChange={(e) => setBatesSuffix(e.target.value)}
                    placeholder=""
                    disabled={isProcessing}
                  />
                </div>

                {/* Preview */}
                <div className="px-4 py-3 bg-surface-100 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                  <div className="text-xs text-surface-500 mb-1">Preview</div>
                  <div className="text-lg font-mono font-medium text-surface-900 dark:text-white">
                    {batesPreviewText}
                  </div>
                </div>
              </div>
            </div>

            {/* Number Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Start Number
                </label>
                <Input
                  type="number"
                  min={1}
                  value={batesStartNumber}
                  onChange={(e) => setBatesStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Number of Digits
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={batesDigits}
                  onChange={(e) => setBatesDigits(Math.min(10, Math.max(1, parseInt(e.target.value) || 6)))}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Font Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Font
                </label>
                <Select
                  value={batesFont}
                  onValueChange={(value) => setBatesFont(value as StandardFontName)}
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
                    value={batesColor}
                    onChange={(e) => setBatesColor(e.target.value)}
                    disabled={isProcessing}
                    className="w-10 h-10 rounded border border-surface-200 dark:border-surface-700 cursor-pointer"
                  />
                  <Input
                    value={batesColor}
                    onChange={(e) => setBatesColor(e.target.value)}
                    disabled={isProcessing}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Font Size Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Font Size
                </label>
                <span className="text-sm text-surface-500">{batesFontSize}pt</span>
              </div>
              <Slider
                value={[batesFontSize]}
                onValueChange={(value) => setBatesFontSize(value[0] ?? 10)}
                min={6}
                max={18}
                step={1}
                disabled={isProcessing}
              />
            </div>

            {/* Apply Button */}
            <Button
              onClick={handleApplyBatesNumbers}
              disabled={!file || isProcessing}
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
                  Add Bates Numbers
                </>
              )}
            </Button>
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
      </CardContent>
    </Card>
  )
}
