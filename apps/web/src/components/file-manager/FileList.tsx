import * as React from 'react'
import {
  FileText,
  MoreVertical,
  Download,
  Trash2,
  Eye,
  Edit,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, formatFileSize, truncateFilename } from '@/lib/utils'
import type { FileItem } from './FileGrid'

export type SortField = 'name' | 'size' | 'pageCount' | 'modifiedAt'
export type SortDirection = 'asc' | 'desc'

export interface FileListProps {
  /** Array of files to display */
  files: FileItem[]
  /** Callback when a file row is clicked */
  onFileClick?: (file: FileItem) => void
  /** Callback when a file row is double-clicked */
  onFileDoubleClick?: (file: FileItem) => void
  /** Callback when a file is selected/deselected */
  onFileSelect?: (file: FileItem, selected: boolean) => void
  /** Callback when download is clicked */
  onDownload?: (file: FileItem) => void
  /** Callback when delete is clicked */
  onDelete?: (file: FileItem) => void
  /** Callback when view is clicked */
  onView?: (file: FileItem) => void
  /** Callback when edit is clicked */
  onEdit?: (file: FileItem) => void
  /** Whether multiple selection is enabled */
  multiSelect?: boolean
  /** Current sort field */
  sortField?: SortField
  /** Current sort direction */
  sortDirection?: SortDirection
  /** Callback when sort changes */
  onSortChange?: (field: SortField, direction: SortDirection) => void
  /** Additional CSS classes */
  className?: string
}

/**
 * List view component for displaying files in a table format.
 * Supports sorting and multi-selection.
 *
 * @example
 * ```tsx
 * <FileList
 *   files={files}
 *   onFileClick={(file) => openFile(file)}
 *   onDownload={(file) => downloadFile(file)}
 *   sortField="name"
 *   sortDirection="asc"
 *   onSortChange={(field, dir) => setSorting({ field, dir })}
 * />
 * ```
 */
export function FileList({
  files,
  onFileClick,
  onFileDoubleClick,
  onFileSelect,
  onDownload,
  onDelete,
  onView,
  onEdit,
  multiSelect = false,
  sortField = 'name',
  sortDirection = 'asc',
  onSortChange,
  className,
}: FileListProps) {
  const handleSort = React.useCallback(
    (field: SortField) => {
      if (field === sortField) {
        onSortChange?.(field, sortDirection === 'asc' ? 'desc' : 'asc')
      } else {
        onSortChange?.(field, 'asc')
      }
    },
    [sortField, sortDirection, onSortChange]
  )

  const handleRowClick = React.useCallback(
    (e: React.MouseEvent, file: FileItem) => {
      if (multiSelect && (e.ctrlKey || e.metaKey)) {
        onFileSelect?.(file, !file.selected)
      } else {
        onFileClick?.(file)
      }
    },
    [multiSelect, onFileClick, onFileSelect]
  )

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="w-4" />
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  if (files.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center',
          className
        )}
      >
        <FileText className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-lg font-medium">No files yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload some PDF files to get started
        </p>
      </div>
    )
  }

  return (
    <div className={cn('w-full overflow-hidden rounded-lg border', className)}>
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="border-b">
            {multiSelect && (
              <th className="w-10 px-4 py-3">
                <span className="sr-only">Select</span>
              </th>
            )}
            <th className="px-4 py-3 text-left">
              <button
                className="flex items-center gap-1 text-sm font-medium hover:text-primary"
                onClick={() => handleSort('name')}
              >
                Name
                <SortIcon field="name" />
              </button>
            </th>
            <th className="hidden px-4 py-3 text-left sm:table-cell">
              <button
                className="flex items-center gap-1 text-sm font-medium hover:text-primary"
                onClick={() => handleSort('size')}
              >
                Size
                <SortIcon field="size" />
              </button>
            </th>
            <th className="hidden px-4 py-3 text-left md:table-cell">
              <button
                className="flex items-center gap-1 text-sm font-medium hover:text-primary"
                onClick={() => handleSort('pageCount')}
              >
                Pages
                <SortIcon field="pageCount" />
              </button>
            </th>
            <th className="hidden px-4 py-3 text-left lg:table-cell">
              <button
                className="flex items-center gap-1 text-sm font-medium hover:text-primary"
                onClick={() => handleSort('modifiedAt')}
              >
                Modified
                <SortIcon field="modifiedAt" />
              </button>
            </th>
            <th className="w-10 px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr
              key={file.id}
              className={cn(
                'cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50',
                file.selected && 'bg-primary/5'
              )}
              onClick={(e) => handleRowClick(e, file)}
              onDoubleClick={() => onFileDoubleClick?.(file)}
            >
              {multiSelect && (
                <td className="px-4 py-3">
                  <div
                    className={cn(
                      'h-5 w-5 rounded-full border-2 transition-colors',
                      file.selected
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/30'
                    )}
                  >
                    {file.selected && (
                      <svg
                        className="h-full w-full text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </td>
              )}
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {file.thumbnail ? (
                    <img
                      src={file.thumbnail}
                      alt=""
                      className="h-10 w-8 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-8 items-center justify-center rounded bg-muted">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="font-medium" title={file.name}>
                    {truncateFilename(file.name, 40)}
                  </span>
                </div>
              </td>
              <td className="hidden px-4 py-3 text-sm text-muted-foreground sm:table-cell">
                {formatFileSize(file.size)}
              </td>
              <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                {file.pageCount ?? '-'}
              </td>
              <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                {file.modifiedAt
                  ? file.modifiedAt.toLocaleDateString()
                  : '-'}
              </td>
              <td className="px-4 py-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onView && (
                      <DropdownMenuItem onClick={() => onView(file)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                    )}
                    {onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(file)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {onDownload && (
                      <DropdownMenuItem onClick={() => onDownload(file)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => onDelete(file)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
