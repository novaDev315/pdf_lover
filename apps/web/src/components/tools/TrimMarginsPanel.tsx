/**
 * TrimMarginsPanel - PDF margin trimming functionality component
 * Auto-detects and removes white margins from PDF pages
 */

import * as React from 'react'
import {
  FileText,
  Scissors,
  Download,
  Loader2,
  X,
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
import { Slider } from '@/components/ui/slider'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { AddToBatchButton } from '@/components/batch/AddToBatchButton'
import { useToast } from '@/hooks/use-toast'
import {
  cn,
  formatFileSize,
  downloadBlob,
  arrayBufferToBlob,
} from '@/lib/utils'
import { trimMargins } from '@pdflover/pdf-core'
import type { ProgressInfo } from '@pdflover/shared'

/**
 * Props for TrimMarginsPanel component
 */
export interface TrimMarginsPanelProps {
  /** Additional CSS classes */
  className?: string
  /** Pre-loaded PDF file */
  initialFile?: File
  /** Callback when trim is complete */
  onComplete?: (result: ArrayBuffer) => void
}

/**
 * PDF Trim Margins Panel component
 *
 * Features:
 * - Whitespace threshold control
 * - Padding after trim
 * - Apply to all or specific pages
 * - Progress indicator
 */
export function TrimMarginsPanel({ className, initialFile, onComplete }: TrimMarginsPanelProps) {
  const [file, setFile] = React.useState<File | null>(initialFile ?? null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const [trimmedResult, setTrimmedResult] = React.useState<ArrayBuffer | null>(null)
  const { toast } = useToast()

  // Trim settings
  const [threshold, setThreshold] = React.useState(250)
  const [padding, setPadding] = React.useState(10)
  const [uniformPadding, setUniformPadding] = React.useState(true)
  const [applyToAllPages, setApplyToAllPages] = React.useState(true)
  const [selectedPages, setSelectedPages] = React.useState('')

  /**
   * Handle file upload
   */
  const handleFileAccepted = React.useCallback(async (files: File[]) => {
    const pdfFile = files[0]
    if (!pdfFile) return

    setFile(pdfFile)
    setTrimmedResult(null)
  }, [])

  /**
   * Clear the selected file
   */
  const handleClearFile = React.useCallback(() => {
    setFile(null)
    setTrimmedResult(null)
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
   * Perform trim operation
   */
  const handleTrim = React.useCallback(async () => {
    if (!file) return

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting trim...')
    setTrimmedResult(null)

    try {
      const buffer = await file.arrayBuffer()
      const pages = parsePageSelection(selectedPages)

      const result = await trimMargins({
        document: buffer,
        threshold,
        padding,
        uniformPadding,
        pages,
        onProgress: handleProgress,
      })

      if (result.success && result.data) {
        setTrimmedResult(result.data)
        onComplete?.(result.data)

        toast({
          title: 'Trim complete',
          description: 'PDF margins have been trimmed successfully.',
        })
      } else {
        throw new Error(result.error ?? 'Failed to trim PDF margins')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Trim failed',
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
    threshold,
    padding,
    uniformPadding,
    selectedPages,
    parsePageSelection,
    handleProgress,
    onComplete,
    toast,
  ])

  /**
   * Download the trimmed PDF
   */
  const handleDownload = React.useCallback(() => {
    if (!trimmedResult || !file) return

    const blob = arrayBufferToBlob(trimmedResult, 'application/pdf')
    const newFilename = file.name.replace(/\.pdf$/i, '_trimmed.pdf')
    downloadBlob(blob, newFilename)
  }, [trimmedResult, file])

  /**
   * Get threshold description
   */
  const getThresholdDescription = React.useCallback((value: number): string => {
    if (value >= 253) return 'Very light trim (minimal)'
    if (value >= 248) return 'Light trim'
    if (value >= 243) return 'Medium trim'
    if (value >= 238) return 'Heavy trim'
    return 'Very heavy trim (aggressive)'
  }, [])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-purple-500" />
          Trim Margins
        </CardTitle>
        <CardDescription>
          Automatically detect and remove white margins from PDF pages.
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

            {/* Threshold Slider */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Trim Intensity</Label>
                  <span className="text-sm text-surface-500 dark:text-surface-400">
                    {getThresholdDescription(threshold)}
                  </span>
                </div>
                <Slider
                  value={[threshold]}
                  onValueChange={([value]) => setThreshold(value ?? 250)}
                  min={230}
                  max={254}
                  step={1}
                  disabled={isProcessing}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400">
                  <span>Aggressive</span>
                  <span>Minimal</span>
                </div>
              </div>
            </div>

            {/* Padding Control */}
            <div className="space-y-2">
              <Label htmlFor="padding" className="text-sm font-medium">
                Padding after trim (points)
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  id="padding"
                  type="number"
                  min={0}
                  max={72}
                  step={1}
                  value={padding}
                  onChange={(e) => setPadding(Number(e.target.value))}
                  disabled={isProcessing}
                  className="w-24"
                />
                <span className="text-sm text-surface-500">
                  ({Math.round(padding / 72 * 25.4)} mm)
                </span>
              </div>
            </div>

            {/* Uniform Padding Toggle */}
            <div className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <Label htmlFor="uniform-padding" className="text-sm cursor-pointer">
                Apply uniform padding on all sides
              </Label>
              <Switch
                id="uniform-padding"
                checked={uniformPadding}
                onCheckedChange={setUniformPadding}
                disabled={isProcessing}
              />
            </div>

            {/* Page Selection */}
            <div className="space-y-3 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
              <div className="flex items-center justify-between">
                <Label htmlFor="apply-all-trim" className="text-sm cursor-pointer">
                  Apply to all pages
                </Label>
                <Switch
                  id="apply-all-trim"
                  checked={applyToAllPages}
                  onCheckedChange={setApplyToAllPages}
                  disabled={isProcessing}
                />
              </div>

              {!applyToAllPages && (
                <div className="space-y-2">
                  <Label htmlFor="page-selection-trim" className="text-sm">
                    Pages (e.g., 1, 3-5, 8):
                  </Label>
                  <Input
                    id="page-selection-trim"
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
            {trimmedResult ? (
              <Button onClick={handleDownload} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download Trimmed PDF
              </Button>
            ) : (
              <Button
                onClick={handleTrim}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Trimming...
                  </>
                ) : (
                  <>
                    <Scissors className="h-4 w-4 mr-2" />
                    Trim Margins
                  </>
                )}
              </Button>
            )}

            <AddToBatchButton
              operationType="trim"
              files={[file]}
              options={{
                threshold,
                padding,
                uniformPadding,
              }}
              disabled={isProcessing}
              onAdded={handleClearFile}
            />

            {trimmedResult && (
              <Button
                variant="outline"
                onClick={handleTrim}
                disabled={isProcessing}
              >
                Re-trim
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
