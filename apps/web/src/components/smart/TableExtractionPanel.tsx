/**
 * TableExtractionPanel - PDF table extraction component
 * Allows users to extract tables from PDF files and export to various formats
 */

import * as React from 'react'
import {
  Table,
  Download,
  Loader2,
  X,
  FileText,
  Check,
  Grid,
  List,
  Copy,
  FileSpreadsheet,
  FileJson,
  Edit2,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  TableIcon,
} from 'lucide-react'
import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import * as XLSX from 'xlsx'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { useToast } from '@/hooks/use-toast'
import { useTableExtraction } from '@/hooks/useTableExtraction'
import { cn, formatFileSize, downloadBlob } from '@/lib/utils'
import type { ExtractedTable } from '@pdflover/pdf-core'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
}

/**
 * Export format options
 */
type ExportFormat = 'csv' | 'xlsx' | 'json'

/**
 * View mode for table display
 */
type ViewMode = 'grid' | 'list'

/**
 * Props for TableExtractionPanel component
 */
export interface TableExtractionPanelProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * PDF Table Extraction Panel component
 *
 * Features:
 * - Upload single PDF
 * - Preview detected tables
 * - Select which tables to extract
 * - Edit cell values before export
 * - Export to CSV, Excel (xlsx), or JSON
 * - Copy to clipboard
 */
export function TableExtractionPanel({ className }: TableExtractionPanelProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = React.useState<number>(0)
  const [selectedTables, setSelectedTables] = React.useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid')
  const [expandedTable, setExpandedTable] = React.useState<string | null>(null)
  const [editingCell, setEditingCell] = React.useState<{
    tableId: string
    row: number
    col: number
  } | null>(null)
  const [editValue, setEditValue] = React.useState('')
  const [detectHeaders, setDetectHeaders] = React.useState(true)
  const [minConfidence, setMinConfidence] = React.useState(50)
  const [isDownloading, setIsDownloading] = React.useState(false)

  const { toast } = useToast()
  const {
    state,
    progress,
    tables,
    extractFromPdf,
    editCell,
    exportToCSV,
    exportAllToCSV,
    exportToExcel,
    exportAllToExcel,
    exportToJSON,
    exportAllToJSON,
    getClipboardText,
    createFilename,
    reset: resetExtraction,
  } = useTableExtraction({
    onComplete: (tbls) => {
      toast({
        title: 'Extraction complete',
        description: `Found ${tbls.length} table${tbls.length !== 1 ? 's' : ''}`,
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
    setSelectedTables(new Set())
    setExpandedTable(null)

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
    setSelectedTables(new Set())
    setExpandedTable(null)
    setEditingCell(null)
    resetExtraction()
  }, [resetExtraction])

  /**
   * Extract tables from PDF
   */
  const handleExtract = React.useCallback(async () => {
    if (!pdfDoc) return

    await extractFromPdf(pdfDoc, {
      detectHeaders,
      minConfidence: minConfidence / 100,
    })
  }, [pdfDoc, detectHeaders, minConfidence, extractFromPdf])

  /**
   * Toggle table selection
   */
  const toggleTableSelection = React.useCallback((id: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  /**
   * Select all tables
   */
  const selectAllTables = React.useCallback(() => {
    setSelectedTables(new Set(tables.map(t => t.id)))
  }, [tables])

  /**
   * Clear table selection
   */
  const clearTableSelection = React.useCallback(() => {
    setSelectedTables(new Set())
  }, [])

  /**
   * Start editing a cell
   */
  const startEditingCell = React.useCallback((tableId: string, row: number, col: number, value: string) => {
    setEditingCell({ tableId, row, col })
    setEditValue(value)
  }, [])

  /**
   * Save cell edit
   */
  const saveEditingCell = React.useCallback(() => {
    if (!editingCell) return

    editCell({
      tableId: editingCell.tableId,
      rowIndex: editingCell.row,
      colIndex: editingCell.col,
      value: editValue,
    })

    setEditingCell(null)
    setEditValue('')
  }, [editingCell, editValue, editCell])

  /**
   * Cancel cell edit
   */
  const cancelEditingCell = React.useCallback(() => {
    setEditingCell(null)
    setEditValue('')
  }, [])

  /**
   * Copy table to clipboard
   */
  const copyToClipboard = React.useCallback(async (tableId: string) => {
    const text = getClipboardText(tableId)
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Copied to clipboard',
        description: 'Table data copied in spreadsheet-compatible format',
      })
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      })
    }
  }, [getClipboardText, toast])

  /**
   * Download single table
   */
  const downloadTable = React.useCallback((tableId: string, format: ExportFormat) => {
    const table = tables.find(t => t.id === tableId)
    if (!table) return

    let content: string | Blob
    let mimeType: string
    const filename = createFilename(table, format)

    switch (format) {
      case 'csv':
        content = exportToCSV(tableId)
        mimeType = 'text/csv'
        downloadBlob(new Blob([content], { type: mimeType }), filename)
        break

      case 'xlsx': {
        const workbook = exportToExcel(tableId)
        const wb = XLSX.utils.book_new()
        for (const sheet of workbook.sheets) {
          const ws = XLSX.utils.aoa_to_sheet(sheet.data)
          // Apply column widths
          if (sheet.columnWidths) {
            ws['!cols'] = sheet.columnWidths.map(w => ({ wch: w }))
          }
          XLSX.utils.book_append_sheet(wb, ws, sheet.name)
        }
        XLSX.writeFile(wb, filename)
        break
      }

      case 'json':
        content = exportToJSON(tableId, detectHeaders)
        mimeType = 'application/json'
        downloadBlob(new Blob([content], { type: mimeType }), filename)
        break
    }

    toast({
      title: 'Download complete',
      description: `Downloaded ${filename}`,
    })
  }, [tables, exportToCSV, exportToExcel, exportToJSON, createFilename, detectHeaders, toast])

  /**
   * Download all tables
   */
  const downloadAllTables = React.useCallback(async (format: ExportFormat) => {
    const tablesToDownload = selectedTables.size > 0
      ? tables.filter(t => selectedTables.has(t.id))
      : tables

    if (tablesToDownload.length === 0) {
      toast({
        title: 'No tables to download',
        description: 'Please extract tables first',
        variant: 'destructive',
      })
      return
    }

    setIsDownloading(true)

    try {
      const baseFilename = file?.name.replace('.pdf', '') || 'tables'

      if (format === 'xlsx') {
        // Create a single Excel file with multiple sheets
        const workbook = exportAllToExcel()
        const wb = XLSX.utils.book_new()
        for (const sheet of workbook.sheets) {
          const ws = XLSX.utils.aoa_to_sheet(sheet.data)
          if (sheet.columnWidths) {
            ws['!cols'] = sheet.columnWidths.map(w => ({ wch: w }))
          }
          XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31)) // Excel sheet name limit
        }
        XLSX.writeFile(wb, `${baseFilename}_tables.xlsx`)

        toast({
          title: 'Download complete',
          description: `Downloaded ${tablesToDownload.length} table(s) as Excel file`,
        })
      } else if (format === 'csv' && tablesToDownload.length > 1) {
        // Create ZIP for multiple CSV files
        const zip = new JSZip()
        for (const table of tablesToDownload) {
          const csv = exportToCSV(table.id)
          const filename = createFilename(table, 'csv')
          zip.file(filename, csv)
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(zipBlob, `${baseFilename}_tables.zip`)

        toast({
          title: 'Download complete',
          description: `Downloaded ${tablesToDownload.length} CSV files as ZIP`,
        })
      } else if (format === 'csv') {
        // Single CSV with all tables
        const csv = exportAllToCSV()
        downloadBlob(new Blob([csv], { type: 'text/csv' }), `${baseFilename}_tables.csv`)

        toast({
          title: 'Download complete',
          description: 'Downloaded all tables as CSV',
        })
      } else if (format === 'json') {
        // Single JSON file
        const json = exportAllToJSON(detectHeaders)
        downloadBlob(new Blob([json], { type: 'application/json' }), `${baseFilename}_tables.json`)

        toast({
          title: 'Download complete',
          description: 'Downloaded all tables as JSON',
        })
      }
    } catch {
      toast({
        title: 'Download failed',
        description: 'Failed to create download file',
        variant: 'destructive',
      })
    } finally {
      setIsDownloading(false)
    }
  }, [
    tables,
    selectedTables,
    file,
    exportToCSV,
    exportAllToCSV,
    exportAllToExcel,
    exportAllToJSON,
    createFilename,
    detectHeaders,
    toast,
  ])

  /**
   * Get tables grouped by page
   */
  const tablesByPage = React.useMemo(() => {
    const grouped = new Map<number, ExtractedTable[]>()
    for (const table of tables) {
      const pageTables = grouped.get(table.page) ?? []
      pageTables.push(table)
      grouped.set(table.page, pageTables)
    }
    return grouped
  }, [tables])

  const isProcessing = state === 'extracting' || state === 'counting' || state === 'detecting'
  const hasTables = tables.length > 0

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TableIcon className="h-5 w-5 text-emerald-500" />
          Extract Tables
        </CardTitle>
        <CardDescription>
          Extract tables from PDF documents and export to CSV, Excel, or JSON.
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
        {file && pdfDoc && !hasTables && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Header Detection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Header Detection
                </label>
                <Select
                  value={detectHeaders ? 'yes' : 'no'}
                  onValueChange={(v) => setDetectHeaders(v === 'yes')}
                  disabled={isProcessing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Detect headers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Auto-detect headers</SelectItem>
                    <SelectItem value="no">No header detection</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Minimum Confidence */}
              <div className="space-y-2">
                <label
                  htmlFor="min-confidence"
                  className="text-sm font-medium text-surface-700 dark:text-surface-300"
                >
                  Min Confidence: {minConfidence}%
                </label>
                <Input
                  id="min-confidence"
                  type="range"
                  min={20}
                  max={90}
                  step={5}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseInt(e.target.value, 10))}
                  disabled={isProcessing}
                  className="cursor-pointer"
                />
              </div>
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
        {file && pdfDoc && !hasTables && (
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
                <Table className="h-4 w-4 mr-2" />
                Extract Tables
              </>
            )}
          </Button>
        )}

        {/* Tables Display */}
        {hasTables && (
          <div className="space-y-4">
            {/* Tables Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-surface-600 dark:text-surface-400">
                  {tables.length} table{tables.length !== 1 ? 's' : ''} found
                  {selectedTables.size > 0 && ` (${selectedTables.size} selected)`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllTables}
                  disabled={isDownloading}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearTableSelection}
                  disabled={selectedTables.size === 0 || isDownloading}
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

            {/* Tables by Page */}
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="all">All Pages</TabsTrigger>
                {Array.from(tablesByPage.keys()).map((page) => (
                  <TabsTrigger key={page} value={`page-${page}`}>
                    Page {page}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <TableGallery
                  tables={tables}
                  selectedTables={selectedTables}
                  expandedTable={expandedTable}
                  viewMode={viewMode}
                  editingCell={editingCell}
                  editValue={editValue}
                  onToggleSelect={toggleTableSelection}
                  onToggleExpand={(id) => setExpandedTable(expandedTable === id ? null : id)}
                  onStartEdit={startEditingCell}
                  onEditValueChange={setEditValue}
                  onSaveEdit={saveEditingCell}
                  onCancelEdit={cancelEditingCell}
                  onCopy={copyToClipboard}
                  onDownload={downloadTable}
                />
              </TabsContent>

              {Array.from(tablesByPage.entries()).map(([page, pageTables]) => (
                <TabsContent key={page} value={`page-${page}`} className="mt-4">
                  <TableGallery
                    tables={pageTables}
                    selectedTables={selectedTables}
                    expandedTable={expandedTable}
                    viewMode={viewMode}
                    editingCell={editingCell}
                    editValue={editValue}
                    onToggleSelect={toggleTableSelection}
                    onToggleExpand={(id) => setExpandedTable(expandedTable === id ? null : id)}
                    onStartEdit={startEditingCell}
                    onEditValueChange={setEditValue}
                    onSaveEdit={saveEditingCell}
                    onCancelEdit={cancelEditingCell}
                    onCopy={copyToClipboard}
                    onDownload={downloadTable}
                  />
                </TabsContent>
              ))}
            </Tabs>

            {/* Export Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={isDownloading || tables.length === 0} className="flex-1">
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        {selectedTables.size > 0
                          ? `Export Selected (${selectedTables.size})`
                          : `Export All (${tables.length})`}
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuItem onClick={() => downloadAllTables('csv')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadAllTables('xlsx')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadAllTables('json')}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Table Gallery component
 */
interface TableGalleryProps {
  tables: ExtractedTable[]
  selectedTables: Set<string>
  expandedTable: string | null
  viewMode: ViewMode
  editingCell: { tableId: string; row: number; col: number } | null
  editValue: string
  onToggleSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onStartEdit: (tableId: string, row: number, col: number, value: string) => void
  onEditValueChange: (value: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onCopy: (tableId: string) => void
  onDownload: (tableId: string, format: ExportFormat) => void
}

function TableGallery({
  tables,
  selectedTables,
  expandedTable,
  viewMode,
  editingCell,
  editValue,
  onToggleSelect,
  onToggleExpand,
  onStartEdit,
  onEditValueChange,
  onSaveEdit,
  onCancelEdit,
  onCopy,
  onDownload,
}: TableGalleryProps) {
  if (tables.length === 0) {
    return (
      <div className="text-center py-8 text-surface-500">
        No tables found on this page.
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {tables.map((table) => (
          <TableListItem
            key={table.id}
            table={table}
            isSelected={selectedTables.has(table.id)}
            isExpanded={expandedTable === table.id}
            editingCell={editingCell}
            editValue={editValue}
            onToggleSelect={() => onToggleSelect(table.id)}
            onToggleExpand={() => onToggleExpand(table.id)}
            onStartEdit={onStartEdit}
            onEditValueChange={onEditValueChange}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onCopy={() => onCopy(table.id)}
            onDownload={(format) => onDownload(table.id, format)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {tables.map((table) => (
        <TableGridItem
          key={table.id}
          table={table}
          isSelected={selectedTables.has(table.id)}
          isExpanded={expandedTable === table.id}
          editingCell={editingCell}
          editValue={editValue}
          onToggleSelect={() => onToggleSelect(table.id)}
          onToggleExpand={() => onToggleExpand(table.id)}
          onStartEdit={onStartEdit}
          onEditValueChange={onEditValueChange}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          onCopy={() => onCopy(table.id)}
          onDownload={(format) => onDownload(table.id, format)}
        />
      ))}
    </div>
  )
}

/**
 * Table Grid Item component
 */
interface TableItemProps {
  table: ExtractedTable
  isSelected: boolean
  isExpanded: boolean
  editingCell: { tableId: string; row: number; col: number } | null
  editValue: string
  onToggleSelect: () => void
  onToggleExpand: () => void
  onStartEdit: (tableId: string, row: number, col: number, value: string) => void
  onEditValueChange: (value: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onCopy: () => void
  onDownload: (format: ExportFormat) => void
}

function TableGridItem({
  table,
  isSelected,
  isExpanded,
  editingCell,
  editValue,
  onToggleSelect,
  onToggleExpand,
  onStartEdit,
  onEditValueChange,
  onSaveEdit,
  onCancelEdit,
  onCopy,
  onDownload,
}: TableItemProps) {
  const previewRows = table.rows.slice(0, 4)
  const previewCols = Math.min(5, table.columnCount)

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden transition-all',
        isSelected
          ? 'border-primary-500 ring-2 ring-primary-500/20'
          : 'border-surface-200 dark:border-surface-700'
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 cursor-pointer"
        onClick={onToggleSelect}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-5 h-5 rounded border-2 flex items-center justify-center',
              isSelected
                ? 'border-primary-500 bg-primary-500'
                : 'border-surface-300 dark:border-surface-600'
            )}
          >
            {isSelected && <Check className="h-3 w-3 text-white" />}
          </div>
          <div>
            <p className="text-sm font-medium text-surface-900 dark:text-white">
              Table {table.index + 1}
            </p>
            <p className="text-xs text-surface-500">
              Page {table.page} - {table.rowCount} rows x {table.columnCount} cols
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              onCopy()
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Download className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDownload('csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload('xlsx')}>Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload('json')}>JSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
          >
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Preview Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <tbody>
            {(isExpanded ? table.rows : previewRows).map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  'border-t border-surface-200 dark:border-surface-700',
                  table.headerRows.includes(rowIndex) && 'bg-surface-100 dark:bg-surface-800 font-medium'
                )}
              >
                {(isExpanded ? row : row.slice(0, previewCols)).map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className={cn(
                      'px-2 py-1.5 text-surface-700 dark:text-surface-300 border-r border-surface-200 dark:border-surface-700 last:border-r-0',
                      'max-w-[150px] truncate'
                    )}
                    onClick={(e) => {
                      if (isExpanded) {
                        e.stopPropagation()
                        onStartEdit(table.id, rowIndex, colIndex, cell)
                      }
                    }}
                  >
                    {editingCell?.tableId === table.id &&
                      editingCell.row === rowIndex &&
                      editingCell.col === colIndex ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editValue}
                          onChange={(e) => onEditValueChange(e.target.value)}
                          className="h-6 text-xs px-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onSaveEdit()
                            if (e.key === 'Escape') onCancelEdit()
                          }}
                        />
                        <Button size="icon" className="h-5 w-5" onClick={onSaveEdit}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={onCancelEdit}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span title={cell}>{cell || '-'}</span>
                    )}
                  </td>
                ))}
                {!isExpanded && row.length > previewCols && (
                  <td className="px-2 py-1.5 text-surface-400 text-center">
                    +{row.length - previewCols}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!isExpanded && table.rows.length > 4 && (
          <div className="text-center py-2 text-xs text-surface-400 border-t border-surface-200 dark:border-surface-700">
            +{table.rows.length - 4} more rows
          </div>
        )}
      </div>

      {/* Expand Hint */}
      {isExpanded && (
        <div className="p-2 bg-surface-50 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700">
          <p className="text-xs text-surface-500 flex items-center gap-1">
            <Edit2 className="h-3 w-3" />
            Click any cell to edit
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Table List Item component
 */
function TableListItem(props: TableItemProps) {
  // List view uses the same component with slightly different styling
  return (
    <div className="col-span-full">
      <TableGridItem {...props} />
    </div>
  )
}
