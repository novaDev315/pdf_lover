/**
 * MergePanel - PDF merge functionality component
 * Allows users to combine multiple PDFs into a single document
 */

import * as React from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  FileText,
  GripVertical,
  X,
  Download,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { AddToBatchButton } from '@/components/batch/AddToBatchButton'
import { useToast } from '@/hooks/use-toast'
import { useOperationHistory } from '@/hooks/useOperationHistory'
import {
  cn,
  formatFileSize,
  generateId,
  downloadBlob,
  arrayBufferToBlob,
} from '@/lib/utils'
import { mergePDFFiles } from '@pdflover/pdf-core'
import type { ProgressInfo } from '@pdflover/shared'

/**
 * Represents a PDF file item in the merge queue
 */
interface MergeFileItem {
  id: string
  file: File
  thumbnail?: string
  pageCount?: number
}

/**
 * Sortable file item component for the merge list
 */
interface SortableFileItemProps {
  item: MergeFileItem
  onRemove: (id: string) => void
}

function SortableFileItem({ item, onRemove }: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 bg-card dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700',
        isDragging && 'shadow-lg opacity-90 z-10'
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-shrink-0 w-12 h-16 bg-surface-100 dark:bg-surface-700 rounded flex items-center justify-center overflow-hidden">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={`Preview of ${item.file.name}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <FileText className="h-6 w-6 text-surface-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
          {item.file.name}
        </p>
        <p className="text-xs text-surface-500 dark:text-surface-400">
          {formatFileSize(item.file.size)}
          {item.pageCount !== undefined && ` - ${item.pageCount} pages`}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="p-1.5 text-surface-400 hover:text-red-500 dark:hover:text-red-400 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        aria-label={`Remove ${item.file.name}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Props for MergePanel component
 */
export interface MergePanelProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * PDF Merge Panel component
 *
 * Features:
 * - Drag and drop file upload
 * - Reorder files with drag and drop
 * - Preview thumbnails
 * - Merge with progress indicator
 * - Download merged PDF
 */
export function MergePanel({ className }: MergePanelProps) {
  const [files, setFiles] = React.useState<MergeFileItem[]>([])
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState<string>('')
  const { toast } = useToast()
  const { recordOperation } = useOperationHistory({ showToasts: false })

  // DnD Kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  /**
   * Handle files dropped or selected
   */
  const handleFilesAccepted = React.useCallback((acceptedFiles: File[]) => {
    const newItems: MergeFileItem[] = acceptedFiles.map((file) => ({
      id: generateId(),
      file,
    }))
    setFiles((prev) => [...prev, ...newItems])

    toast({
      title: 'Files added',
      description: `Added ${acceptedFiles.length} file(s) to merge queue`,
    })
  }, [toast])

  /**
   * Remove a file from the merge queue
   */
  const handleRemoveFile = React.useCallback((id: string) => {
    setFiles((prev) => prev.filter((item) => item.id !== id))
  }, [])

  /**
   * Clear all files from the queue
   */
  const handleClearAll = React.useCallback(() => {
    setFiles([])
  }, [])

  /**
   * Handle drag end for reordering
   */
  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }, [])

  /**
   * Handle progress updates during merge
   */
  const handleProgress = React.useCallback((info: ProgressInfo) => {
    setProgress(info.percentage)
    if (info.stage) {
      setProgressStage(info.stage)
    }
  }, [])

  /**
   * Merge all PDFs and download the result
   */
  const handleMerge = React.useCallback(async () => {
    if (files.length < 2) {
      toast({
        title: 'Not enough files',
        description: 'Please add at least 2 PDF files to merge',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting merge...')

    try {
      const result = await mergePDFFiles(
        files.map((item) => item.file),
        {
          outputFilename: 'merged.pdf',
          onProgress: handleProgress,
        }
      )

      if (result.success && result.data) {
        const blob = arrayBufferToBlob(result.data, 'application/pdf')
        downloadBlob(blob, 'merged.pdf')

        toast({
          title: 'Merge complete',
          description: `Successfully merged ${files.length} PDFs (${formatFileSize(result.processedSize ?? 0)})`,
        })

        // Record to operation history
        recordOperation({
          type: 'merge',
          description: `Merged ${files.length} PDFs into one document`,
          after: blob,
          canUndo: false, // Merge creates new file, original files are unchanged
          fileNames: files.map((item) => item.file.name),
          fileSize: result.processedSize ?? blob.size,
        })

        // Clear the queue after successful merge
        setFiles([])
      } else {
        throw new Error(result.error ?? 'Failed to merge PDFs')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Merge failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [files, handleProgress, toast])

  const totalSize = React.useMemo(
    () => files.reduce((sum, item) => sum + item.file.size, 0),
    [files]
  )

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-500" />
          Merge PDFs
        </CardTitle>
        <CardDescription>
          Combine multiple PDF files into a single document. Drag to reorder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Dropzone */}
        <FileDropzone
          onFilesAccepted={handleFilesAccepted}
          multiple
          maxFiles={100}
          disabled={isProcessing}
        />

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Files to merge ({files.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={isProcessing}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear all
              </Button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={files.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {files.map((item) => (
                    <SortableFileItem
                      key={item.id}
                      item={item}
                      onRemove={handleRemoveFile}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Summary */}
            <div className="flex items-center justify-between text-sm text-surface-600 dark:text-surface-400 pt-2 border-t border-surface-200 dark:border-surface-700">
              <span>Total size: {formatFileSize(totalSize)}</span>
              <span>{files.length} files</span>
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
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleMerge}
            disabled={files.length < 2 || isProcessing}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Merge & Download
              </>
            )}
          </Button>

          {files.length > 0 && !isProcessing && (
            <>
              <AddToBatchButton
                operationType="merge"
                files={files.map((item) => item.file)}
                options={{ outputFilename: 'merged.pdf' }}
                disabled={files.length < 2 || isProcessing}
                onAdded={handleClearAll}
              />
              <FileDropzone
                onFilesAccepted={handleFilesAccepted}
                multiple
                maxFiles={100}
                className="flex-shrink-0"
              >
                <Button variant="outline" type="button" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add more files
                </Button>
              </FileDropzone>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
