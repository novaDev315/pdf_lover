/**
 * WatermarkPanel - PDF watermark tools component
 * Allows users to add text or image watermarks to PDFs
 */

import * as React from 'react'
import {
  Droplets,
  Type,
  Image,
  Loader2,
  Download,
  RotateCcw,
  Eye,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  readFileAsDataURL,
} from '@/lib/utils'
import {
  addTextWatermark,
  addImageWatermark,
  type WatermarkPosition,
} from '@pdflover/pdf-core'
import type { ProgressInfo } from '@pdflover/shared'

/**
 * Position button component
 */
interface PositionButtonProps {
  position: WatermarkPosition
  selected: boolean
  onClick: () => void
  disabled?: boolean
}

function PositionButton({ position, selected, onClick, disabled }: PositionButtonProps) {
  const labels: Record<WatermarkPosition, string> = {
    center: 'Center',
    diagonal: 'Diagonal',
    top: 'Top',
    bottom: 'Bottom',
    'top-left': 'Top Left',
    'top-right': 'Top Right',
    'bottom-left': 'Bottom Left',
    'bottom-right': 'Bottom Right',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
        selected
          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/20 dark:text-primary-300'
          : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {labels[position]}
    </button>
  )
}

/**
 * Props for WatermarkPanel component
 */
export interface WatermarkPanelProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * PDF Watermark Panel component
 *
 * Features:
 * - Text watermark with customizable options
 * - Image watermark support
 * - Position selection
 * - Opacity, rotation, and font size controls
 * - Preview before applying
 */
export function WatermarkPanel({ className }: WatermarkPanelProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const [activeTab, setActiveTab] = React.useState('text')
  const { toast } = useToast()

  // Text watermark settings
  const [text, setText] = React.useState('CONFIDENTIAL')
  const [position, setPosition] = React.useState<WatermarkPosition>('diagonal')
  const [opacity, setOpacity] = React.useState(30)
  const [fontSize, setFontSize] = React.useState(72)
  const [color, setColor] = React.useState('#888888')
  const [rotation, setRotation] = React.useState(-45)
  const [repeat, setRepeat] = React.useState(false)

  // Image watermark settings
  const [watermarkImage, setWatermarkImage] = React.useState<string | null>(null)
  const [imageScale, setImageScale] = React.useState(30)
  const [imagePosition, setImagePosition] = React.useState<WatermarkPosition>('center')
  const [imageOpacity, setImageOpacity] = React.useState(30)
  const [imageRotation, setImageRotation] = React.useState(0)

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
        description: `Ready to add watermark to ${selectedFile.name}`,
      })
    },
    [toast]
  )

  /**
   * Handle watermark image selection
   */
  const handleImageSelected = React.useCallback(
    async (acceptedFiles: File[]) => {
      const selectedFile = acceptedFiles[0]
      if (!selectedFile) return

      try {
        const dataUrl = await readFileAsDataURL(selectedFile)
        setWatermarkImage(dataUrl)
        toast({
          title: 'Image loaded',
          description: 'Watermark image ready to apply',
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
   * Apply text watermark
   */
  const handleApplyTextWatermark = React.useCallback(async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a PDF file first',
        variant: 'destructive',
      })
      return
    }

    if (!text.trim()) {
      toast({
        title: 'No text entered',
        description: 'Please enter watermark text',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting...')

    try {
      const buffer = await file.arrayBuffer()
      const result = await addTextWatermark({
        document: buffer,
        text: text.trim(),
        position,
        opacity: opacity / 100,
        fontSize,
        color,
        rotation: position === 'diagonal' ? rotation : 0,
        repeat,
        repeatSpacing: 200,
        onProgress: handleProgress,
      })

      if (result.success && result.data) {
        const blob = arrayBufferToBlob(result.data, 'application/pdf')
        const filename = file.name.replace('.pdf', '_watermarked.pdf')
        downloadBlob(blob, filename)

        toast({
          title: 'Watermark applied',
          description: `Successfully watermarked ${file.name}`,
        })
      } else {
        throw new Error(result.error ?? 'Failed to apply watermark')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Watermark failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [file, text, position, opacity, fontSize, color, rotation, repeat, handleProgress, toast])

  /**
   * Apply image watermark
   */
  const handleApplyImageWatermark = React.useCallback(async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a PDF file first',
        variant: 'destructive',
      })
      return
    }

    if (!watermarkImage) {
      toast({
        title: 'No image selected',
        description: 'Please select a watermark image',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting...')

    try {
      const buffer = await file.arrayBuffer()
      const result = await addImageWatermark({
        document: buffer,
        imageData: watermarkImage,
        position: imagePosition,
        opacity: imageOpacity / 100,
        scale: imageScale / 100,
        rotation: imageRotation,
        onProgress: handleProgress,
      })

      if (result.success && result.data) {
        const blob = arrayBufferToBlob(result.data, 'application/pdf')
        const filename = file.name.replace('.pdf', '_watermarked.pdf')
        downloadBlob(blob, filename)

        toast({
          title: 'Watermark applied',
          description: `Successfully watermarked ${file.name}`,
        })
      } else {
        throw new Error(result.error ?? 'Failed to apply watermark')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Watermark failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [file, watermarkImage, imagePosition, imageOpacity, imageScale, imageRotation, handleProgress, toast])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-blue-500" />
          Add Watermark
        </CardTitle>
        <CardDescription>
          Add text or image watermarks to your PDF documents.
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
            <Droplets className="h-5 w-5 text-surface-500" />
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

        {/* Watermark Type Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Text
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Image
            </TabsTrigger>
          </TabsList>

          {/* Text Watermark Tab */}
          <TabsContent value="text" className="space-y-4 mt-4">
            {/* Watermark Text */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Watermark Text
              </label>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter watermark text"
                disabled={isProcessing}
              />
            </div>

            {/* Position */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Position
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['diagonal', 'center', 'top', 'bottom'] as WatermarkPosition[]).map((pos) => (
                  <PositionButton
                    key={pos}
                    position={pos}
                    selected={position === pos}
                    onClick={() => setPosition(pos)}
                    disabled={isProcessing}
                  />
                ))}
              </div>
            </div>

            {/* Opacity Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Opacity
                </label>
                <span className="text-sm text-surface-500">{opacity}%</span>
              </div>
              <Slider
                value={[opacity]}
                onValueChange={(value) => setOpacity(value[0] ?? 30)}
                min={5}
                max={100}
                step={5}
                disabled={isProcessing}
              />
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
                onValueChange={(value) => setFontSize(value[0] ?? 72)}
                min={12}
                max={144}
                step={4}
                disabled={isProcessing}
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Color
              </label>
              <div className="flex items-center gap-3">
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
                  placeholder="#888888"
                  disabled={isProcessing}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Rotation Slider (for diagonal) */}
            {position === 'diagonal' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Rotation
                  </label>
                  <span className="text-sm text-surface-500">{rotation} degrees</span>
                </div>
                <Slider
                  value={[rotation]}
                  onValueChange={(value) => setRotation(value[0] ?? -45)}
                  min={-90}
                  max={90}
                  step={5}
                  disabled={isProcessing}
                />
              </div>
            )}

            {/* Repeat Pattern Checkbox */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
                disabled={isProcessing}
                className="h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
              />
              <div>
                <p className="text-sm font-medium text-surface-900 dark:text-white">
                  Repeat pattern
                </p>
                <p className="text-xs text-surface-500">
                  Tile the watermark across the entire page
                </p>
              </div>
            </label>

            {/* Apply Text Watermark Button */}
            <Button
              onClick={handleApplyTextWatermark}
              disabled={!file || !text.trim() || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Apply Watermark
                </>
              )}
            </Button>
          </TabsContent>

          {/* Image Watermark Tab */}
          <TabsContent value="image" className="space-y-4 mt-4">
            {/* Watermark Image Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Watermark Image
              </label>
              {watermarkImage ? (
                <div className="flex items-center gap-3 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
                  <img
                    src={watermarkImage}
                    alt="Watermark preview"
                    className="w-16 h-16 object-contain rounded"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">
                      Image loaded
                    </p>
                    <p className="text-xs text-surface-500">Ready to apply</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWatermarkImage(null)}
                    disabled={isProcessing}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div
                  className={cn(
                    'border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg p-6 text-center cursor-pointer hover:border-primary-500 transition-colors',
                    isProcessing && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={(e) => {
                      const files = e.target.files
                      if (files && files.length > 0) {
                        handleImageSelected(Array.from(files))
                      }
                    }}
                    disabled={isProcessing}
                    className="hidden"
                    id="watermark-image-input"
                  />
                  <label
                    htmlFor="watermark-image-input"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Image className="h-8 w-8 text-surface-400 mb-2" />
                    <p className="text-sm text-surface-600 dark:text-surface-400">
                      Click to upload watermark image
                    </p>
                    <p className="text-xs text-surface-400 mt-1">PNG or JPG</p>
                  </label>
                </div>
              )}
            </div>

            {/* Image Position */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Position
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'] as WatermarkPosition[]).map((pos) => (
                  <PositionButton
                    key={pos}
                    position={pos}
                    selected={imagePosition === pos}
                    onClick={() => setImagePosition(pos)}
                    disabled={isProcessing}
                  />
                ))}
              </div>
            </div>

            {/* Image Scale Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Scale
                </label>
                <span className="text-sm text-surface-500">{imageScale}%</span>
              </div>
              <Slider
                value={[imageScale]}
                onValueChange={(value) => setImageScale(value[0] ?? 30)}
                min={5}
                max={100}
                step={5}
                disabled={isProcessing}
              />
            </div>

            {/* Image Opacity Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Opacity
                </label>
                <span className="text-sm text-surface-500">{imageOpacity}%</span>
              </div>
              <Slider
                value={[imageOpacity]}
                onValueChange={(value) => setImageOpacity(value[0] ?? 30)}
                min={5}
                max={100}
                step={5}
                disabled={isProcessing}
              />
            </div>

            {/* Image Rotation Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Rotation
                </label>
                <span className="text-sm text-surface-500">{imageRotation} degrees</span>
              </div>
              <Slider
                value={[imageRotation]}
                onValueChange={(value) => setImageRotation(value[0] ?? 0)}
                min={-180}
                max={180}
                step={15}
                disabled={isProcessing}
              />
            </div>

            {/* Apply Image Watermark Button */}
            <Button
              onClick={handleApplyImageWatermark}
              disabled={!file || !watermarkImage || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Apply Watermark
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
