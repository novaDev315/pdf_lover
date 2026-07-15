/**
 * CropPanel - PDF page cropping functionality component
 * Provides visual crop box editor with drag and precise input controls
 */

import * as React from 'react'
import {
  FileText,
  Crop,
  Download,
  Loader2,
  X,
  Lock,
  Unlock,
  RotateCcw,
  Move,
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
  cropPages,
  fromPoints,
  toPoints,
  type CropBox,
  type CropBoxPercent,
  type DimensionUnit,
} from '@pdflover/pdf-core'
import type { ProgressInfo } from '@pdflover/shared'
import * as pdfjsLib from 'pdfjs-dist'

/**
 * Props for CropPanel component
 */
export interface CropPanelProps {
  /** Additional CSS classes */
  className?: string
  /** Pre-loaded PDF file */
  initialFile?: File
  /** Callback when crop is complete */
  onComplete?: (result: ArrayBuffer) => void
}

type CropMode = 'absolute' | 'percentage'
type BoxType = 'MediaBox' | 'CropBox' | 'TrimBox' | 'BleedBox'

/**
 * PDF Crop Panel component
 *
 * Features:
 * - Visual crop box editor on PDF preview
 * - Drag corners/edges to adjust crop area
 * - Input fields for precise dimensions
 * - Aspect ratio lock toggle
 * - Apply to all pages or current page
 * - Preview before/after
 */
export function CropPanel({ className, initialFile, onComplete }: CropPanelProps) {
  const [file, setFile] = React.useState<File | null>(initialFile ?? null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const [croppedResult, setCroppedResult] = React.useState<ArrayBuffer | null>(null)
  const { toast } = useToast()

  // Crop settings
  const [cropMode, setCropMode] = React.useState<CropMode>('percentage')
  const [boxType, setBoxType] = React.useState<BoxType>('CropBox')
  const [unit, setUnit] = React.useState<DimensionUnit>('pt')
  const [aspectRatioLocked, setAspectRatioLocked] = React.useState(false)
  const [applyToAllPages, setApplyToAllPages] = React.useState(true)
  const [currentPage, setCurrentPage] = React.useState(1)

  // Absolute crop values (in points)
  const [cropX, setCropX] = React.useState(0)
  const [cropY, setCropY] = React.useState(0)
  const [cropWidth, setCropWidth] = React.useState(595) // A4 width
  const [cropHeight, setCropHeight] = React.useState(842) // A4 height

  // Percentage crop values
  const [cropLeft, setCropLeft] = React.useState(0)
  const [cropRight, setCropRight] = React.useState(0)
  const [cropTop, setCropTop] = React.useState(0)
  const [cropBottom, setCropBottom] = React.useState(0)

  // Preview state
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)

  // Interactive crop box state
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragHandle, setDragHandle] = React.useState<string | null>(null)

  /**
   * Handle file upload
   */
  const handleFileAccepted = React.useCallback(async (files: File[]) => {
    const pdfFile = files[0]
    if (!pdfFile) return

    setFile(pdfFile)
    setCroppedResult(null)

    setPreviewUrl(null)
    try {
      const bytes = await pdfFile.arrayBuffer()
      const documentProxy = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise
      const page = await documentProxy.getPage(1)
      const viewport = page.getViewport({ scale: 1 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas 2D rendering is unavailable')
      await page.render({ canvasContext: context, viewport }).promise
      setCropWidth(viewport.width)
      setCropHeight(viewport.height)
      setPreviewUrl(canvas.toDataURL('image/png'))
      await documentProxy.destroy()
    } catch (error) {
      setPreviewUrl(null)
      toast({
        title: 'Preview unavailable',
        description: error instanceof Error ? error.message : 'The first page could not be rendered',
        variant: 'destructive',
      })
    }
  }, [toast])

  /**
   * Clear the selected file
   */
  const handleClearFile = React.useCallback(() => {
    setFile(null)
    setCroppedResult(null)
    setPreviewUrl(null)
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
   * Reset crop values to defaults
   */
  const handleReset = React.useCallback(() => {
    setCropX(0)
    setCropY(0)
    setCropWidth(595)
    setCropHeight(842)
    setCropLeft(0)
    setCropRight(0)
    setCropTop(0)
    setCropBottom(0)
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
   * Perform crop operation
   */
  const handleCrop = React.useCallback(async () => {
    if (!file) return

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting crop...')
    setCroppedResult(null)

    try {
      const buffer = await file.arrayBuffer()

      const options: Parameters<typeof cropPages>[0] = {
        document: buffer,
        boxType,
        onProgress: handleProgress,
        pages: applyToAllPages ? undefined : [currentPage],
      }

      if (cropMode === 'absolute') {
        options.cropBox = {
          x: cropX,
          y: cropY,
          width: cropWidth,
          height: cropHeight,
        } as CropBox
      } else {
        options.cropPercent = {
          left: cropLeft,
          right: cropRight,
          top: cropTop,
          bottom: cropBottom,
        } as CropBoxPercent
      }

      const result = await cropPages(options)

      if (result.success && result.data) {
        setCroppedResult(result.data)
        onComplete?.(result.data)

        toast({
          title: 'Crop complete',
          description: 'PDF pages have been cropped successfully.',
        })
      } else {
        throw new Error(result.error ?? 'Failed to crop PDF')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Crop failed',
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
    cropMode,
    boxType,
    applyToAllPages,
    currentPage,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    cropLeft,
    cropRight,
    cropTop,
    cropBottom,
    handleProgress,
    onComplete,
    toast,
  ])

  /**
   * Download the cropped PDF
   */
  const handleDownload = React.useCallback(() => {
    if (!croppedResult || !file) return

    const blob = arrayBufferToBlob(croppedResult, 'application/pdf')
    const newFilename = file.name.replace(/\.pdf$/i, '_cropped.pdf')
    downloadBlob(blob, newFilename)
  }, [croppedResult, file])

  /**
   * Handle crop box mouse interactions
   */
  const handleCropBoxMouseDown = React.useCallback(
    (e: React.MouseEvent, handle: string) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      setDragHandle(handle)
    },
    []
  )

  const handleCropBoxMouseUp = React.useCallback(() => {
    setIsDragging(false)
    setDragHandle(null)
  }, [])

  // Cleanup preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crop className="h-5 w-5 text-blue-500" />
          Crop PDF Pages
        </CardTitle>
        <CardDescription>
          Crop pages to a specific area. Adjust margins or select a region to keep.
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
          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center gap-4 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
              <div className="flex-shrink-0 w-12 h-16 bg-card dark:bg-surface-700 rounded flex items-center justify-center">
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

            {/* Crop Preview Area */}
            <div className="relative aspect-[3/4] bg-surface-100 dark:bg-surface-800 rounded-lg border-2 border-dashed border-surface-300 dark:border-surface-600 overflow-hidden">
              {previewUrl ? (
                <div className="relative w-full h-full">
                  <img
                    src={previewUrl}
                    alt="First PDF page crop preview"
                    className="h-full w-full object-contain"
                  />

                  {/* Visual Crop Box Overlay */}
                  {cropMode === 'percentage' && (
                    <div
                      className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                      style={{
                        left: `${cropLeft}%`,
                        right: `${cropRight}%`,
                        top: `${cropTop}%`,
                        bottom: `${cropBottom}%`,
                      }}
                    >
                      {/* Corner handles */}
                      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-500 rounded-full cursor-nw-resize" />
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full cursor-ne-resize" />
                      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-500 rounded-full cursor-sw-resize" />
                      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-surface-500">
                    <Move className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Crop area visualization</p>
                  </div>
                </div>
              )}
            </div>

            {/* Crop Mode Toggle */}
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium">Crop Mode:</Label>
              <Select
                value={cropMode}
                onValueChange={(v) => setCropMode(v as CropMode)}
                disabled={isProcessing}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="absolute">Absolute</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Percentage Mode Controls */}
            {cropMode === 'percentage' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="crop-left" className="text-sm">
                    Left (%)
                  </Label>
                  <Input
                    id="crop-left"
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    value={cropLeft}
                    onChange={(e) => setCropLeft(Number(e.target.value))}
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="crop-right" className="text-sm">
                    Right (%)
                  </Label>
                  <Input
                    id="crop-right"
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    value={cropRight}
                    onChange={(e) => setCropRight(Number(e.target.value))}
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="crop-top" className="text-sm">
                    Top (%)
                  </Label>
                  <Input
                    id="crop-top"
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    value={cropTop}
                    onChange={(e) => setCropTop(Number(e.target.value))}
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="crop-bottom" className="text-sm">
                    Bottom (%)
                  </Label>
                  <Input
                    id="crop-bottom"
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    value={cropBottom}
                    onChange={(e) => setCropBottom(Number(e.target.value))}
                    disabled={isProcessing}
                  />
                </div>
              </div>
            )}

            {/* Absolute Mode Controls */}
            {cropMode === 'absolute' && (
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
                      <SelectItem value="pt">Points</SelectItem>
                      <SelectItem value="mm">Millimeters</SelectItem>
                      <SelectItem value="in">Inches</SelectItem>
                      <SelectItem value="px">Pixels</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
                    className="ml-auto"
                  >
                    {aspectRatioLocked ? (
                      <Lock className="h-4 w-4 mr-2" />
                    ) : (
                      <Unlock className="h-4 w-4 mr-2" />
                    )}
                    Aspect Ratio
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="crop-x" className="text-sm">
                      X Offset
                    </Label>
                    <Input
                      id="crop-x"
                      type="number"
                      min={0}
                      step={1}
                      value={pointsToDisplay(cropX)}
                      onChange={(e) => setCropX(displayToPoints(Number(e.target.value)))}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crop-y" className="text-sm">
                      Y Offset
                    </Label>
                    <Input
                      id="crop-y"
                      type="number"
                      min={0}
                      step={1}
                      value={pointsToDisplay(cropY)}
                      onChange={(e) => setCropY(displayToPoints(Number(e.target.value)))}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crop-width" className="text-sm">
                      Width
                    </Label>
                    <Input
                      id="crop-width"
                      type="number"
                      min={1}
                      step={1}
                      value={pointsToDisplay(cropWidth)}
                      onChange={(e) => setCropWidth(displayToPoints(Number(e.target.value)))}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crop-height" className="text-sm">
                      Height
                    </Label>
                    <Input
                      id="crop-height"
                      type="number"
                      min={1}
                      step={1}
                      value={pointsToDisplay(cropHeight)}
                      onChange={(e) => setCropHeight(displayToPoints(Number(e.target.value)))}
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Box Type Selection */}
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium">Box Type:</Label>
              <Select
                value={boxType}
                onValueChange={(v) => setBoxType(v as BoxType)}
                disabled={isProcessing}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CropBox">CropBox</SelectItem>
                  <SelectItem value="MediaBox">MediaBox</SelectItem>
                  <SelectItem value="TrimBox">TrimBox</SelectItem>
                  <SelectItem value="BleedBox">BleedBox</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Apply To Options */}
            <div className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Switch
                  id="apply-all"
                  checked={applyToAllPages}
                  onCheckedChange={setApplyToAllPages}
                  disabled={isProcessing}
                />
                <Label htmlFor="apply-all" className="text-sm cursor-pointer">
                  Apply to all pages
                </Label>
              </div>

              {!applyToAllPages && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Page:</Label>
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={currentPage}
                    onChange={(e) => setCurrentPage(Number(e.target.value))}
                    disabled={isProcessing}
                  />
                </div>
              )}
            </div>

            {/* Reset Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isProcessing}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Crop Settings
            </Button>
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
            {croppedResult ? (
              <Button onClick={handleDownload} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download Cropped PDF
              </Button>
            ) : (
              <Button
                onClick={handleCrop}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cropping...
                  </>
                ) : (
                  <>
                    <Crop className="h-4 w-4 mr-2" />
                    Crop PDF
                  </>
                )}
              </Button>
            )}

            <AddToBatchButton
              operationType="crop"
              files={[file]}
              options={{
                cropMode,
                boxType,
                ...(cropMode === 'percentage'
                  ? { cropPercent: { left: cropLeft, right: cropRight, top: cropTop, bottom: cropBottom } }
                  : { cropBox: { x: cropX, y: cropY, width: cropWidth, height: cropHeight } }),
              }}
              disabled={isProcessing}
              onAdded={handleClearFile}
            />

            {croppedResult && (
              <Button
                variant="outline"
                onClick={handleCrop}
                disabled={isProcessing}
              >
                Re-crop
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
