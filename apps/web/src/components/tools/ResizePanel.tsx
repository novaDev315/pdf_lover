/**
 * ResizePanel - PDF page resizing functionality component
 * Provides preset sizes, custom dimensions, and scaling options
 */

import * as React from 'react'
import {
  FileText,
  Maximize,
  Download,
  Loader2,
  X,
  Lock,
  Unlock,
  Check,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { AddToBatchButton } from '@/components/batch/AddToBatchButton'
import { useToast } from '@/hooks/use-toast'
import {
  cn,
  formatFileSize,
  downloadBlob,
  arrayBufferToBlob,
} from '@/lib/utils'
import {
  resizePages,
  setPageSize,
  PAGE_SIZES,
  fromPoints,
  toPoints,
  type PageSizeName,
  type DimensionUnit,
} from '@pdflover/pdf-core'
import type { ProgressInfo } from '@pdflover/shared'

/**
 * Preset page size configuration
 */
interface PresetConfig {
  name: PageSizeName
  label: string
  dimensions: string
  icon?: React.ReactNode
}

const PAGE_PRESETS: PresetConfig[] = [
  { name: 'A4', label: 'A4', dimensions: '210 x 297 mm' },
  { name: 'Letter', label: 'Letter', dimensions: '8.5 x 11 in' },
  { name: 'Legal', label: 'Legal', dimensions: '8.5 x 14 in' },
  { name: 'A3', label: 'A3', dimensions: '297 x 420 mm' },
  { name: 'A5', label: 'A5', dimensions: '148 x 210 mm' },
  { name: 'Tabloid', label: 'Tabloid', dimensions: '11 x 17 in' },
]

/**
 * Props for ResizePanel component
 */
export interface ResizePanelProps {
  /** Additional CSS classes */
  className?: string
  /** Pre-loaded PDF file */
  initialFile?: File
  /** Callback when resize is complete */
  onComplete?: (result: ArrayBuffer) => void
}

type ResizeMode = 'preset' | 'custom'
type Orientation = 'portrait' | 'landscape'

/**
 * PDF Resize Panel component
 *
 * Features:
 * - Preset size buttons (A4, Letter, Legal, etc.)
 * - Custom size inputs (width x height)
 * - Units selector (mm, inches, pixels, points)
 * - Scale content checkbox
 * - Center content checkbox
 * - Preserve aspect ratio toggle
 * - Apply to pages selector
 */
export function ResizePanel({ className, initialFile, onComplete }: ResizePanelProps) {
  const [file, setFile] = React.useState<File | null>(initialFile ?? null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const [resizedResult, setResizedResult] = React.useState<ArrayBuffer | null>(null)
  const { toast } = useToast()

  // Resize settings
  const [resizeMode, setResizeMode] = React.useState<ResizeMode>('preset')
  const [selectedPreset, setSelectedPreset] = React.useState<PageSizeName>('A4')
  const [orientation, setOrientation] = React.useState<Orientation>('portrait')
  const [unit, setUnit] = React.useState<DimensionUnit>('mm')

  // Custom dimensions (stored in points)
  const [customWidth, setCustomWidth] = React.useState<number>(PAGE_SIZES.A4.width)
  const [customHeight, setCustomHeight] = React.useState<number>(PAGE_SIZES.A4.height)

  // Options
  const [preserveAspectRatio, setPreserveAspectRatio] = React.useState(true)
  const [scaleContent, setScaleContent] = React.useState(true)
  const [centerContent, setCenterContent] = React.useState(true)
  const [applyToAllPages, setApplyToAllPages] = React.useState(true)
  const [selectedPages, setSelectedPages] = React.useState('')

  /**
   * Handle file upload
   */
  const handleFileAccepted = React.useCallback(async (files: File[]) => {
    const pdfFile = files[0]
    if (!pdfFile) return

    setFile(pdfFile)
    setResizedResult(null)
  }, [])

  /**
   * Clear the selected file
   */
  const handleClearFile = React.useCallback(() => {
    setFile(null)
    setResizedResult(null)
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
   * Convert display value to points
   */
  const displayToPoints = React.useCallback((value: number): number => {
    return toPoints(value, unit)
  }, [unit])

  /**
   * Convert points to display value
   */
  const pointsToDisplay = React.useCallback((value: number): number => {
    return Math.round(fromPoints(value, unit) * 100) / 100
  }, [unit])

  /**
   * Handle preset selection
   */
  const handlePresetSelect = React.useCallback((preset: PageSizeName) => {
    setSelectedPreset(preset)
    const size = PAGE_SIZES[preset]
    if (orientation === 'portrait') {
      setCustomWidth(size.width)
      setCustomHeight(size.height)
    } else {
      setCustomWidth(size.height)
      setCustomHeight(size.width)
    }
  }, [orientation])

  /**
   * Handle orientation change
   */
  const handleOrientationChange = React.useCallback((newOrientation: Orientation) => {
    setOrientation(newOrientation)
    // Swap dimensions
    setCustomWidth(customHeight)
    setCustomHeight(customWidth)
  }, [customWidth, customHeight])

  /**
   * Handle width change with aspect ratio lock
   */
  const handleWidthChange = React.useCallback((newWidth: number) => {
    const widthInPoints = displayToPoints(newWidth)
    setCustomWidth(widthInPoints)

    if (preserveAspectRatio && customWidth > 0) {
      const ratio = customHeight / customWidth
      setCustomHeight(widthInPoints * ratio)
    }
  }, [displayToPoints, preserveAspectRatio, customWidth, customHeight])

  /**
   * Handle height change with aspect ratio lock
   */
  const handleHeightChange = React.useCallback((newHeight: number) => {
    const heightInPoints = displayToPoints(newHeight)
    setCustomHeight(heightInPoints)

    if (preserveAspectRatio && customHeight > 0) {
      const ratio = customWidth / customHeight
      setCustomWidth(heightInPoints * ratio)
    }
  }, [displayToPoints, preserveAspectRatio, customWidth, customHeight])

  /**
   * Parse page selection string to array
   */
  const parsePageSelection = React.useCallback((input: string): number[] | undefined => {
    if (!input.trim() || applyToAllPages) return undefined

    const pages: number[] = []
    const parts = input.split(',')

    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map((s) => parseInt(s.trim(), 10))
        if (!isNaN(start!) && !isNaN(end!)) {
          for (let i = start!; i <= end!; i++) {
            pages.push(i)
          }
        }
      } else {
        const num = parseInt(trimmed, 10)
        if (!isNaN(num)) {
          pages.push(num)
        }
      }
    }

    return pages.length > 0 ? [...new Set(pages)].sort((a, b) => a - b) : undefined
  }, [applyToAllPages])

  /**
   * Perform resize operation
   */
  const handleResize = React.useCallback(async () => {
    if (!file) return

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting resize...')
    setResizedResult(null)

    try {
      const buffer = await file.arrayBuffer()
      const pages = parsePageSelection(selectedPages)

      let result

      if (resizeMode === 'preset') {
        result = await setPageSize({
          document: buffer,
          size: selectedPreset,
          scaleContent,
          centerContent,
          orientation,
          pages,
          onProgress: handleProgress,
        })
      } else {
        result = await resizePages({
          document: buffer,
          width: customWidth,
          height: customHeight,
          preserveAspectRatio: false, // Already handled in input
          scaleContent,
          centerContent,
          pages,
          onProgress: handleProgress,
        })
      }

      if (result.success && result.data) {
        setResizedResult(result.data)
        onComplete?.(result.data)

        toast({
          title: 'Resize complete',
          description: 'PDF pages have been resized successfully.',
        })
      } else {
        throw new Error(result.error ?? 'Failed to resize PDF')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Resize failed',
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
    resizeMode,
    selectedPreset,
    orientation,
    customWidth,
    customHeight,
    scaleContent,
    centerContent,
    selectedPages,
    parsePageSelection,
    handleProgress,
    onComplete,
    toast,
  ])

  /**
   * Download the resized PDF
   */
  const handleDownload = React.useCallback(() => {
    if (!resizedResult || !file) return

    const blob = arrayBufferToBlob(resizedResult, 'application/pdf')
    const newFilename = file.name.replace(/\.pdf$/i, '_resized.pdf')
    downloadBlob(blob, newFilename)
  }, [resizedResult, file])

  /**
   * Get unit label
   */
  const getUnitLabel = React.useCallback((u: DimensionUnit): string => {
    const labels: Record<DimensionUnit, string> = {
      pt: 'pt',
      mm: 'mm',
      in: 'in',
      px: 'px',
    }
    return labels[u]
  }, [])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Maximize className="h-5 w-5 text-green-500" />
          Resize PDF Pages
        </CardTitle>
        <CardDescription>
          Change page dimensions using preset sizes or custom dimensions.
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
          <div className="space-y-6">
            {/* File Info */}
            <div className="flex items-center gap-4 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
              <div className="flex-shrink-0 w-12 h-16 bg-white dark:bg-surface-700 rounded flex items-center justify-center">
                <FileText className="h-6 w-6 text-surface-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                  {file.name}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {formatFileSize(file.size)}
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

            {/* Resize Mode Toggle */}
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium">Size Mode:</Label>
              <Select
                value={resizeMode}
                onValueChange={(v) => setResizeMode(v as ResizeMode)}
                disabled={isProcessing}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preset">Preset Sizes</SelectItem>
                  <SelectItem value="custom">Custom Size</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preset Size Selection */}
            {resizeMode === 'preset' && (
              <div className="space-y-4">
                <Label className="text-sm font-medium">Select Page Size:</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PAGE_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handlePresetSelect(preset.name)}
                      disabled={isProcessing}
                      className={cn(
                        'p-3 rounded-lg border-2 text-left transition-colors',
                        'hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950',
                        selectedPreset === preset.name
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                          : 'border-surface-200 dark:border-surface-700'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-surface-900 dark:text-white">
                          {preset.label}
                        </span>
                        {selectedPreset === preset.name && (
                          <Check className="h-4 w-4 text-primary-500" />
                        )}
                      </div>
                      <span className="text-xs text-surface-500 dark:text-surface-400">
                        {preset.dimensions}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Orientation Toggle */}
                <div className="flex items-center gap-4">
                  <Label className="text-sm font-medium">Orientation:</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={orientation === 'portrait' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleOrientationChange('portrait')}
                      disabled={isProcessing}
                    >
                      Portrait
                    </Button>
                    <Button
                      variant={orientation === 'landscape' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleOrientationChange('landscape')}
                      disabled={isProcessing}
                    >
                      Landscape
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Size Controls */}
            {resizeMode === 'custom' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label className="text-sm font-medium">Units:</Label>
                  <Select
                    value={unit}
                    onValueChange={(v) => setUnit(v as DimensionUnit)}
                    disabled={isProcessing}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mm">Millimeters</SelectItem>
                      <SelectItem value="in">Inches</SelectItem>
                      <SelectItem value="pt">Points</SelectItem>
                      <SelectItem value="px">Pixels</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreserveAspectRatio(!preserveAspectRatio)}
                    className="ml-auto"
                  >
                    {preserveAspectRatio ? (
                      <Lock className="h-4 w-4 mr-2" />
                    ) : (
                      <Unlock className="h-4 w-4 mr-2" />
                    )}
                    Aspect Ratio
                  </Button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="custom-width" className="text-sm">
                      Width ({getUnitLabel(unit)})
                    </Label>
                    <Input
                      id="custom-width"
                      type="number"
                      min={1}
                      step={0.1}
                      value={pointsToDisplay(customWidth)}
                      onChange={(e) => handleWidthChange(Number(e.target.value))}
                      disabled={isProcessing}
                    />
                  </div>

                  <X className="h-4 w-4 text-surface-400 mt-6" />

                  <div className="flex-1 space-y-2">
                    <Label htmlFor="custom-height" className="text-sm">
                      Height ({getUnitLabel(unit)})
                    </Label>
                    <Input
                      id="custom-height"
                      type="number"
                      min={1}
                      step={0.1}
                      value={pointsToDisplay(customHeight)}
                      onChange={(e) => handleHeightChange(Number(e.target.value))}
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Content Options */}
            <div className="space-y-3 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <h4 className="text-sm font-medium text-surface-900 dark:text-white">
                Content Options
              </h4>

              <div className="flex items-center justify-between">
                <Label htmlFor="scale-content" className="text-sm cursor-pointer">
                  Scale content to fit
                </Label>
                <Switch
                  id="scale-content"
                  checked={scaleContent}
                  onCheckedChange={setScaleContent}
                  disabled={isProcessing}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="center-content" className="text-sm cursor-pointer">
                  Center content on page
                </Label>
                <Switch
                  id="center-content"
                  checked={centerContent}
                  onCheckedChange={setCenterContent}
                  disabled={isProcessing || !scaleContent}
                />
              </div>
            </div>

            {/* Page Selection */}
            <div className="space-y-3 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <div className="flex items-center justify-between">
                <Label htmlFor="apply-all" className="text-sm cursor-pointer">
                  Apply to all pages
                </Label>
                <Switch
                  id="apply-all"
                  checked={applyToAllPages}
                  onCheckedChange={setApplyToAllPages}
                  disabled={isProcessing}
                />
              </div>

              {!applyToAllPages && (
                <div className="space-y-2">
                  <Label htmlFor="page-selection" className="text-sm">
                    Pages (e.g., 1, 3-5, 8):
                  </Label>
                  <Input
                    id="page-selection"
                    type="text"
                    placeholder="1, 3-5, 8"
                    value={selectedPages}
                    onChange={(e) => setSelectedPages(e.target.value)}
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
            {resizedResult ? (
              <Button onClick={handleDownload} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download Resized PDF
              </Button>
            ) : (
              <Button
                onClick={handleResize}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resizing...
                  </>
                ) : (
                  <>
                    <Maximize className="h-4 w-4 mr-2" />
                    Resize PDF
                  </>
                )}
              </Button>
            )}

            <AddToBatchButton
              operationType="resize"
              files={[file]}
              options={{
                resizeMode,
                preset: selectedPreset,
                orientation,
                width: customWidth,
                height: customHeight,
                scaleContent,
                centerContent,
              }}
              disabled={isProcessing}
              onAdded={handleClearFile}
            />

            {resizedResult && (
              <Button
                variant="outline"
                onClick={handleResize}
                disabled={isProcessing}
              >
                Re-resize
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
