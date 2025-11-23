/**
 * TOCPanel - Table of Contents generation and editing component
 *
 * Features:
 * - Auto-detect headings from PDF
 * - Editable tree structure
 * - Drag and drop reordering
 * - Adjust heading levels
 * - Generate and insert TOC
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
  List,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Download,
  Loader2,
  Wand2,
  Edit2,
  Check,
  X,
  FileText,
  Settings2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { useToast } from '@/hooks/use-toast'
import {
  cn,
  formatFileSize,
  generateId,
  downloadBlob,
  arrayBufferToBlob,
} from '@/lib/utils'
import {
  generateTOC,
  insertTOC,
  detectHeadingStyles,
  type TOCEntry,
  type HeadingStyle,
  type InsertTOCOptions,
} from '@pdflover/pdf-core'
import type { ProgressInfo } from '@pdflover/shared'

/**
 * Internal TOC entry with editing state
 */
interface EditableTOCEntry extends TOCEntry {
  isEditing?: boolean
}

/**
 * Props for sortable TOC item
 */
interface SortableTOCItemProps {
  entry: EditableTOCEntry
  onRemove: (id: string) => void
  onEdit: (id: string, newTitle: string) => void
  onLevelChange: (id: string, delta: number) => void
  onStartEdit: (id: string) => void
  onCancelEdit: (id: string) => void
  maxLevel: number
}

/**
 * Sortable TOC entry item component
 */
function SortableTOCItem({
  entry,
  onRemove,
  onEdit,
  onLevelChange,
  onStartEdit,
  onCancelEdit,
  maxLevel,
}: SortableTOCItemProps) {
  const [editValue, setEditValue] = React.useState(entry.title)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  React.useEffect(() => {
    if (entry.isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [entry.isEditing])

  const handleSaveEdit = () => {
    if (editValue.trim()) {
      onEdit(entry.id, editValue.trim())
    } else {
      onCancelEdit(entry.id)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      setEditValue(entry.title)
      onCancelEdit(entry.id)
    }
  }

  const indentWidth = (entry.level - 1) * 20

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700',
        isDragging && 'shadow-lg opacity-90 z-10'
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Indent indicator */}
      <div style={{ width: indentWidth }} className="flex-shrink-0">
        {entry.level > 1 && (
          <div className="h-px bg-surface-300 dark:bg-surface-600 w-full" />
        )}
      </div>

      {/* Level badge */}
      <span
        className={cn(
          'flex-shrink-0 w-6 h-6 rounded text-xs font-medium flex items-center justify-center',
          entry.level === 1 && 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
          entry.level === 2 && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
          entry.level >= 3 && 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300'
        )}
      >
        H{entry.level}
      </span>

      {/* Title */}
      {entry.isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 text-sm"
          />
          <button
            type="button"
            onClick={handleSaveEdit}
            className="p-1 text-green-500 hover:text-green-600"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditValue(entry.title)
              onCancelEdit(entry.id)
            }}
            className="p-1 text-red-500 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <span
          className="flex-1 text-sm text-surface-900 dark:text-white truncate cursor-pointer hover:text-primary-600 dark:hover:text-primary-400"
          onClick={() => onStartEdit(entry.id)}
          title="Click to edit"
        >
          {entry.title}
        </span>
      )}

      {/* Page number */}
      <span className="flex-shrink-0 text-xs text-surface-500 dark:text-surface-400 tabular-nums">
        p. {entry.page}
      </span>

      {/* Level controls */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onLevelChange(entry.id, -1)}
          disabled={entry.level <= 1}
          className={cn(
            'p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700',
            entry.level <= 1 && 'opacity-30 cursor-not-allowed'
          )}
          title="Decrease level (promote)"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onLevelChange(entry.id, 1)}
          disabled={entry.level >= maxLevel}
          className={cn(
            'p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-700',
            entry.level >= maxLevel && 'opacity-30 cursor-not-allowed'
          )}
          title="Increase level (demote)"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Edit button */}
      {!entry.isEditing && (
        <button
          type="button"
          onClick={() => onStartEdit(entry.id)}
          className="p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 rounded hover:bg-surface-100 dark:hover:bg-surface-700"
          title="Edit title"
        >
          <Edit2 className="h-3 w-3" />
        </button>
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(entry.id)}
        className="p-1 text-surface-400 hover:text-red-500 dark:hover:text-red-400 rounded hover:bg-surface-100 dark:hover:bg-surface-700"
        title="Remove entry"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

/**
 * Props for TOCPanel component
 */
export interface TOCPanelProps {
  /** Additional CSS classes */
  className?: string
  /** Callback when TOC is generated */
  onTOCGenerated?: (entries: TOCEntry[]) => void
  /** Callback when PDF with TOC is ready */
  onPDFReady?: (data: ArrayBuffer, entries: TOCEntry[]) => void
}

/**
 * TOC Panel component for generating and editing Table of Contents
 */
export function TOCPanel({ className, onTOCGenerated, onPDFReady }: TOCPanelProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [pdfData, setPdfData] = React.useState<ArrayBuffer | null>(null)
  const [entries, setEntries] = React.useState<EditableTOCEntry[]>([])
  const [headingStyles, setHeadingStyles] = React.useState<HeadingStyle[]>([])
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const [showOptions, setShowOptions] = React.useState(false)
  const { toast } = useToast()

  // TOC generation options
  const [minFontSize, setMinFontSize] = React.useState(14)
  const [maxLevels, setMaxLevels] = React.useState(3)

  // TOC insertion options
  const [tocTitle, setTocTitle] = React.useState('Table of Contents')
  const [includePageNumbers, setIncludePageNumbers] = React.useState(true)
  const [includeLinks, setIncludeLinks] = React.useState(true)
  const [showDottedLeaders, setShowDottedLeaders] = React.useState(true)

  // DnD sensors
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
   * Handle progress updates
   */
  const handleProgress = React.useCallback((info: ProgressInfo) => {
    setProgress(info.percentage)
    if (info.stage) {
      setProgressStage(info.stage)
    }
  }, [])

  /**
   * Handle file selection
   */
  const handleFilesAccepted = React.useCallback(async (acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setEntries([])
    setHeadingStyles([])

    try {
      const buffer = await selectedFile.arrayBuffer()
      setPdfData(buffer)

      toast({
        title: 'PDF loaded',
        description: `${selectedFile.name} (${formatFileSize(selectedFile.size)})`,
      })
    } catch (error) {
      toast({
        title: 'Failed to load PDF',
        description: 'Please try a different file',
        variant: 'destructive',
      })
    }
  }, [toast])

  /**
   * Auto-detect headings in the PDF
   */
  const handleDetectHeadings = React.useCallback(async () => {
    if (!pdfData) {
      toast({
        title: 'No file loaded',
        description: 'Please upload a PDF file first',
        variant: 'destructive',
      })
      return
    }

    setIsAnalyzing(true)
    setProgress(0)
    setProgressStage('Analyzing document...')

    try {
      // First detect heading styles
      const styles = await detectHeadingStyles(pdfData, {
        onProgress: handleProgress,
      })
      setHeadingStyles(styles)

      // Then generate TOC entries
      const tocEntries = await generateTOC(pdfData, {
        minFontSize,
        maxLevels,
        onProgress: handleProgress,
      })

      const editableEntries: EditableTOCEntry[] = tocEntries.map((e) => ({
        ...e,
        isEditing: false,
      }))

      setEntries(editableEntries)
      onTOCGenerated?.(tocEntries)

      if (tocEntries.length === 0) {
        toast({
          title: 'No headings found',
          description: 'Try adjusting the minimum font size or add entries manually',
        })
      } else {
        toast({
          title: 'Headings detected',
          description: `Found ${tocEntries.length} headings across ${new Set(tocEntries.map((e) => e.page)).size} pages`,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to analyze PDF'
      toast({
        title: 'Analysis failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsAnalyzing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [pdfData, minFontSize, maxLevels, handleProgress, onTOCGenerated, toast])

  /**
   * Generate PDF with TOC
   */
  const handleGenerateTOC = React.useCallback(async () => {
    if (!pdfData || entries.length === 0) {
      toast({
        title: 'Cannot generate TOC',
        description: 'Please upload a PDF and detect or add headings first',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setProgressStage('Generating TOC...')

    try {
      const insertOptions: InsertTOCOptions = {
        title: tocTitle,
        includePageNumbers,
        includeLinks,
        showDottedLeaders,
        onProgress: handleProgress,
      }

      // Convert editable entries back to regular entries
      const tocEntries: TOCEntry[] = entries.map(({ isEditing, ...rest }) => rest)

      const result = await insertTOC(pdfData, tocEntries, insertOptions)

      if (result.success && result.data) {
        onPDFReady?.(result.data, tocEntries)

        const blob = arrayBufferToBlob(result.data, 'application/pdf')
        const filename = file?.name.replace('.pdf', '_with_toc.pdf') || 'document_with_toc.pdf'
        downloadBlob(blob, filename)

        toast({
          title: 'TOC generated successfully',
          description: `${entries.length} entries added to ${filename}`,
        })
      } else {
        throw new Error(result.error || 'Failed to generate TOC')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate TOC'
      toast({
        title: 'Generation failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [pdfData, entries, file, tocTitle, includePageNumbers, includeLinks, showDottedLeaders, handleProgress, onPDFReady, toast])

  /**
   * Add a new manual entry
   */
  const handleAddEntry = React.useCallback(() => {
    const newEntry: EditableTOCEntry = {
      id: generateId(),
      title: 'New Entry',
      page: 1,
      level: 1,
      isEditing: true,
    }
    setEntries((prev) => [...prev, newEntry])
  }, [])

  /**
   * Remove an entry
   */
  const handleRemoveEntry = React.useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  /**
   * Edit an entry's title
   */
  const handleEditEntry = React.useCallback((id: string, newTitle: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, title: newTitle, isEditing: false } : e
      )
    )
  }, [])

  /**
   * Change an entry's level
   */
  const handleLevelChange = React.useCallback((id: string, delta: number) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e
        const newLevel = Math.max(1, Math.min(maxLevels, e.level + delta))
        return { ...e, level: newLevel }
      })
    )
  }, [maxLevels])

  /**
   * Start editing an entry
   */
  const handleStartEdit = React.useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) => ({ ...e, isEditing: e.id === id }))
    )
  }, [])

  /**
   * Cancel editing
   */
  const handleCancelEdit = React.useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isEditing: false } : e))
    )
  }, [])

  /**
   * Handle drag end for reordering
   */
  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setEntries((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }, [])

  /**
   * Clear all entries
   */
  const handleClearAll = React.useCallback(() => {
    setEntries([])
  }, [])

  const isProcessing = isAnalyzing || isGenerating

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <List className="h-5 w-5 text-blue-500" />
          Table of Contents Generator
        </CardTitle>
        <CardDescription>
          Auto-detect headings and generate a clickable Table of Contents for your PDF.
          All processing happens locally in your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Dropzone */}
        <FileDropzone
          onFilesAccepted={handleFilesAccepted}
          multiple={false}
          maxFiles={1}
          disabled={isProcessing}
        />

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
              onClick={() => {
                setFile(null)
                setPdfData(null)
                setEntries([])
                setHeadingStyles([])
              }}
              disabled={isProcessing}
            >
              Change
            </Button>
          </div>
        )}

        {/* Options Toggle */}
        {pdfData && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOptions(!showOptions)}
              className="text-surface-600 dark:text-surface-400"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              {showOptions ? 'Hide Options' : 'Show Options'}
            </Button>

            {showOptions && (
              <div className="space-y-4 p-4 bg-surface-50 dark:bg-surface-900 rounded-lg">
                {/* Detection Options */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Detection Settings
                  </h4>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-surface-600 dark:text-surface-400">
                        Minimum Font Size
                      </label>
                      <span className="text-sm font-medium">{minFontSize}pt</span>
                    </div>
                    <Slider
                      value={[minFontSize]}
                      onValueChange={([value]) => setMinFontSize(value!)}
                      min={8}
                      max={24}
                      step={1}
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-surface-600 dark:text-surface-400">
                        Max Heading Levels
                      </label>
                      <span className="text-sm font-medium">{maxLevels}</span>
                    </div>
                    <Slider
                      value={[maxLevels]}
                      onValueChange={([value]) => setMaxLevels(value!)}
                      min={1}
                      max={6}
                      step={1}
                      disabled={isProcessing}
                    />
                  </div>
                </div>

                {/* TOC Options */}
                <div className="space-y-3 pt-3 border-t border-surface-200 dark:border-surface-700">
                  <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    TOC Settings
                  </h4>

                  <div className="space-y-2">
                    <label className="text-sm text-surface-600 dark:text-surface-400">
                      TOC Title
                    </label>
                    <Input
                      value={tocTitle}
                      onChange={(e) => setTocTitle(e.target.value)}
                      placeholder="Table of Contents"
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includePageNumbers}
                        onChange={(e) => setIncludePageNumbers(e.target.checked)}
                        disabled={isProcessing}
                        className="rounded border-surface-300"
                      />
                      <span className="text-sm text-surface-600 dark:text-surface-400">
                        Page Numbers
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeLinks}
                        onChange={(e) => setIncludeLinks(e.target.checked)}
                        disabled={isProcessing}
                        className="rounded border-surface-300"
                      />
                      <span className="text-sm text-surface-600 dark:text-surface-400">
                        Clickable Links
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDottedLeaders}
                        onChange={(e) => setShowDottedLeaders(e.target.checked)}
                        disabled={isProcessing}
                        className="rounded border-surface-300"
                      />
                      <span className="text-sm text-surface-600 dark:text-surface-400">
                        Dotted Leaders
                      </span>
                    </label>
                  </div>
                </div>

                {/* Detected Styles Info */}
                {headingStyles.length > 0 && (
                  <div className="pt-3 border-t border-surface-200 dark:border-surface-700">
                    <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                      Detected Heading Styles
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {headingStyles.slice(0, maxLevels).map((style) => (
                        <span
                          key={style.level}
                          className="px-2 py-1 bg-surface-200 dark:bg-surface-700 rounded text-xs"
                        >
                          H{style.level}: {style.fontSize}pt
                          {style.isBold && ' (bold)'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Auto-detect Button */}
        {pdfData && (
          <Button
            onClick={handleDetectHeadings}
            disabled={isProcessing}
            variant="outline"
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Auto-Detect Headings
              </>
            )}
          </Button>
        )}

        {/* TOC Entries List */}
        {entries.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-surface-700 dark:text-surface-300">
                TOC Entries ({entries.length})
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddEntry}
                  disabled={isProcessing}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={isProcessing}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={entries.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {entries.map((entry) => (
                    <SortableTOCItem
                      key={entry.id}
                      entry={entry}
                      onRemove={handleRemoveEntry}
                      onEdit={handleEditEntry}
                      onLevelChange={handleLevelChange}
                      onStartEdit={handleStartEdit}
                      onCancelEdit={handleCancelEdit}
                      maxLevel={maxLevels}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Empty state for entries */}
        {pdfData && entries.length === 0 && !isAnalyzing && (
          <div className="text-center py-8 border border-dashed border-surface-300 dark:border-surface-600 rounded-lg">
            <List className="h-10 w-10 mx-auto text-surface-400 mb-3" />
            <p className="text-sm text-surface-600 dark:text-surface-400 mb-4">
              No TOC entries yet. Click "Auto-Detect Headings" to analyze the document
              or add entries manually.
            </p>
            <Button variant="outline" size="sm" onClick={handleAddEntry}>
              <Plus className="h-4 w-4 mr-2" />
              Add Entry Manually
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

        {/* Generate TOC Button */}
        {entries.length > 0 && (
          <Button
            onClick={handleGenerateTOC}
            disabled={isProcessing || entries.length === 0}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate & Download with TOC
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
