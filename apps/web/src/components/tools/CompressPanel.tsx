/**
 * CompressPanel - PDF compression functionality component
 * Allows users to reduce PDF file size with configurable compression levels
 */

import * as React from 'react'
import {
  FileText,
  Minimize2,
  Download,
  Loader2,
  X,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'

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
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { AddToBatchButton } from '@/components/batch/AddToBatchButton'
import { useToast } from '@/hooks/use-toast'
import { useOperationHistory } from '@/hooks/useOperationHistory'
import {
  cn,
  formatFileSize,
  downloadBlob,
  arrayBufferToBlob,
} from '@/lib/utils'
import { compressPDF, estimateCompression } from '@pdflover/pdf-core'
import type { ProgressInfo, CompressionLevel } from '@pdflover/shared'
import { useSettingsStore } from '@/store/settings-store'
import { useApiCapabilities } from '@/hooks/useApiCapabilities'
import { getOperationCapability, runServerPdfOperation } from '@/lib/api'

/**
 * Compression level configuration
 */
interface CompressionConfig {
  level: CompressionLevel
  label: string
  description: string
}

const COMPRESSION_LEVELS: CompressionConfig[] = [
  {
    level: 'low',
    label: 'Fast local',
    description: 'Fast lossless structural rewrite; the interface may pause briefly',
  },
  {
    level: 'medium',
    label: 'Responsive local',
    description: 'The same lossless rewrite with balanced browser responsiveness',
  },
  {
    level: 'high',
    label: 'Smooth local',
    description: 'The same lossless rewrite with more frequent interface updates',
  },
  {
    level: 'maximum',
    label: 'Maximum',
    description: 'Lossy image recompression on the configured backend',
  },
]

/**
 * Props for CompressPanel component
 */
export interface CompressPanelProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * PDF Compress Panel component
 *
 * Features:
 * - Upload single PDF
 * - Compression level selector
 * - Before/after file size display
 * - Estimated savings preview
 * - Progress indicator during compression
 * - Download compressed PDF
 */
export function CompressPanel({ className }: CompressPanelProps) {
  const defaultCompressionLevel = useSettingsStore(
    (state) => state.processing.defaultCompressionLevel,
  )
  const [file, setFile] = React.useState<File | null>(null)
  const [compressionLevel, setCompressionLevel] = React.useState<number>(() => {
    const index = COMPRESSION_LEVELS.findIndex(
      (configuration) => configuration.level === defaultCompressionLevel,
    )
    return index >= 0 ? index : 1
  })
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const [estimatedSavings, setEstimatedSavings] = React.useState<number | null>(null)
  const [compressedSize, setCompressedSize] = React.useState<number | null>(null)
  const [compressionResult, setCompressionResult] = React.useState<ArrayBuffer | null>(null)
  const [serverConsent, setServerConsent] = React.useState(false)
  const { toast } = useToast()
  const { recordOperation } = useOperationHistory({ showToasts: false })
  const capabilities = useApiCapabilities()

  const currentConfig = COMPRESSION_LEVELS[compressionLevel] ?? COMPRESSION_LEVELS[1]!
  const isMaximum = currentConfig.level === 'maximum'
  const maximumCapability = getOperationCapability(capabilities.data, 'pdf.compress.lossy')
  const maximumAvailable = maximumCapability?.available === true

  /**
   * Handle file upload
   */
  const handleFileAccepted = React.useCallback(async (files: File[]) => {
    const pdfFile = files[0]
    if (!pdfFile) return

    setFile(pdfFile)
    setCompressedSize(null)
    setCompressionResult(null)
    setServerConsent(false)

    // Estimate compression
    try {
      const buffer = await pdfFile.arrayBuffer()
      const estimate = await estimateCompression(buffer)
      setEstimatedSavings(estimate.estimatedSavings)
    } catch {
      setEstimatedSavings(null)
    }
  }, [])

  /**
   * Clear the selected file
   */
  const handleClearFile = React.useCallback(() => {
    setFile(null)
    setEstimatedSavings(null)
    setCompressedSize(null)
    setCompressionResult(null)
    setServerConsent(false)
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
   * Perform compression
   */
  const handleCompress = React.useCallback(async () => {
    if (!file) return

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting compression...')
    setCompressedSize(null)
    setCompressionResult(null)

    try {
      if (isMaximum && (!serverConsent || !maximumAvailable)) {
        throw new Error('Maximum compression requires an available backend and upload consent')
      }

      const result = isMaximum
        ? await runServerPdfOperation({
            operation: 'pdf.compress.lossy',
            file,
            options: { quality: 60, dpi: 120 },
            onProgress: handleProgress,
          }).then((artifacts) => {
            const artifact = artifacts[0]
            if (!artifact) throw new Error('The server returned no compressed PDF')
            return {
              success: true as const,
              data: artifact.data,
              processedSize: artifact.data.byteLength,
              error: undefined,
            }
          })
        : await compressPDF({
            document: await file.arrayBuffer(),
            level: currentConfig.level,
            onProgress: handleProgress,
          })

      if (result.success && result.data) {
        setCompressedSize(result.processedSize ?? result.data.byteLength)
        setCompressionResult(result.data)

        const savings = file.size - (result.processedSize ?? result.data.byteLength)
        const savingsPercent = ((savings / file.size) * 100).toFixed(1)

        if (savings > 0) {
          toast({
            title: 'Compression complete',
            description: `Reduced file size by ${formatFileSize(savings)} (${savingsPercent}%)`,
          })

          // Record to operation history
          recordOperation({
            type: 'compress',
            description: `Compressed ${file.name} (${savingsPercent}% smaller)`,
            canUndo: false,
            fileNames: [file.name],
            fileSize: result.processedSize ?? result.data.byteLength,
            metadata: { originalSize: file.size, savings, savingsPercent },
          })
        } else {
          toast({
            title: 'Compression complete',
            description: 'File is already optimized. No significant size reduction achieved.',
          })

          // Still record to history
          recordOperation({
            type: 'compress',
            description: `Attempted compression of ${file.name} (already optimized)`,
            canUndo: false,
            fileNames: [file.name],
            fileSize: result.processedSize ?? result.data.byteLength,
          })
        }
      } else {
        throw new Error(result.error ?? 'Failed to compress PDF')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Compression failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [file, currentConfig.level, isMaximum, serverConsent, maximumAvailable, handleProgress, toast, recordOperation])

  /**
   * Download the compressed PDF
   */
  const handleDownload = React.useCallback(() => {
    if (!compressionResult || !file) return

    const blob = arrayBufferToBlob(compressionResult, 'application/pdf')
    const newFilename = file.name.replace(/\.pdf$/i, '_compressed.pdf')
    downloadBlob(blob, newFilename)
  }, [compressionResult, file])

  /**
   * Calculate compression statistics
   */
  const compressionStats = React.useMemo(() => {
    if (!file || compressedSize === null) return null

    const originalSize = file.size
    const savings = originalSize - compressedSize
    const savingsPercent = (savings / originalSize) * 100
    const compressionRatio = originalSize / compressedSize

    return {
      originalSize,
      compressedSize,
      savings,
      savingsPercent,
      compressionRatio,
    }
  }, [file, compressedSize])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Minimize2 className="h-5 w-5 text-orange-500" />
          Compress PDF
        </CardTitle>
        <CardDescription>
          Reduce PDF file size while maintaining quality.
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
            <div className="flex-shrink-0 w-12 h-16 bg-card dark:bg-surface-700 rounded flex items-center justify-center">
              <FileText className="h-6 w-6 text-surface-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                {file.name}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {formatFileSize(file.size)}
                {isMaximum && estimatedSavings !== null && estimatedSavings > 0 ? (
                  <span className="ml-2 text-green-600 dark:text-green-400">
                    ~{estimatedSavings}% estimated savings
                  </span>
                ) : (
                  <span className="ml-2 text-surface-500">savings depend on document content</span>
                )}
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

        {/* Compression Level Selector */}
        {file && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Compression Level
                </label>
                <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                  {currentConfig.label}
                </span>
              </div>
              <Slider
                value={[compressionLevel]}
                onValueChange={([value]) => {
                  setCompressionLevel(value ?? 1)
                  setServerConsent(false)
                  setCompressedSize(null)
                  setCompressionResult(null)
                }}
                min={0}
                max={3}
                step={1}
                disabled={isProcessing}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400">
                <span>Fast</span>
                <span>Responsive</span>
                <span>Smooth</span>
                <span>Max</span>
              </div>
            </div>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              {currentConfig.description}
            </p>
          </div>
        )}

        {file && isMaximum && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-800 dark:bg-blue-950/30">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="space-y-2">
                <p className="font-medium text-blue-950 dark:text-blue-100">Temporary server processing required</p>
                <p className="text-blue-800 dark:text-blue-200">
                  Maximum mode uploads this PDF for lossy image recompression. Job files expire automatically.
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-blue-950 dark:text-blue-100">
                  <input
                    type="checkbox"
                    checked={serverConsent}
                    onChange={(event) => setServerConsent(event.target.checked)}
                    disabled={!maximumAvailable || isProcessing}
                    className="mt-0.5 h-4 w-4"
                  />
                  I consent to temporary backend processing for this file.
                </label>
              </div>
            </div>
            {!capabilities.isLoading && !maximumAvailable && (
              <p className="mt-3 text-amber-900 dark:text-amber-200" role="status">
                {maximumCapability?.unavailableReason ?? 'Maximum compression is unavailable on the configured backend.'}
              </p>
            )}
          </div>
        )}

        {/* Compression Results */}
        {compressionStats && (
          <div className="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-surface-900 dark:text-white">
                Compression Results
              </h4>
              {compressionStats.savings > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                  <TrendingDown className="h-3 w-3" />
                  {compressionStats.savingsPercent.toFixed(1)}% smaller
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  No size reduction
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 text-center p-3 bg-card dark:bg-surface-700 rounded-lg">
                <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">
                  Original
                </p>
                <p className="text-lg font-semibold text-surface-900 dark:text-white">
                  {formatFileSize(compressionStats.originalSize)}
                </p>
              </div>

              <ArrowRight className="h-5 w-5 text-surface-400 flex-shrink-0" />

              <div className={cn(
                'flex-1 rounded-lg p-3 text-center',
                compressionStats.savings > 0
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-amber-50 dark:bg-amber-900/20',
              )}>
                <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">
                  Compressed
                </p>
                <p className={cn(
                  'text-lg font-semibold',
                  compressionStats.savings > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-amber-700 dark:text-amber-300',
                )}>
                  {formatFileSize(compressionStats.compressedSize)}
                </p>
              </div>
            </div>

            {compressionStats.savings > 0 && (
              <p className="text-sm text-center text-surface-600 dark:text-surface-400 mt-3">
                Saved {formatFileSize(compressionStats.savings)}
              </p>
            )}
            {compressionStats.savings <= 0 && (
              <p className="mt-3 text-center text-sm text-amber-800 dark:text-amber-300">
                This result is {formatFileSize(Math.abs(compressionStats.savings))} larger. Keep the original unless you need the recompressed copy.
              </p>
            )}
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
            {compressionResult ? (
              <Button
                onClick={handleDownload}
                variant={compressionStats && compressionStats.savings <= 0 ? 'outline' : 'default'}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                {compressionStats && compressionStats.savings <= 0 ? 'Download Larger Result' : 'Download Compressed PDF'}
              </Button>
            ) : (
              <Button
                onClick={handleCompress}
                disabled={isProcessing || (isMaximum && (!serverConsent || !maximumAvailable))}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Compressing...
                  </>
                ) : (
                  <>
                    <Minimize2 className="h-4 w-4 mr-2" />
                    Compress PDF
                  </>
                )}
              </Button>
            )}

            <AddToBatchButton
              operationType="compress"
              files={[file]}
              options={{ level: currentConfig.level, serverConsent }}
              disabled={isProcessing || (isMaximum && !maximumAvailable)}
              onAdded={handleClearFile}
            />

            {compressionResult && (
              <Button
                variant="outline"
                onClick={handleCompress}
                disabled={isProcessing}
              >
                Recompress
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
