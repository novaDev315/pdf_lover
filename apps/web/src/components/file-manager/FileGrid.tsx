import * as React from 'react'
import {
  FileText,
  MoreVertical,
  Download,
  Trash2,
  Eye,
  Edit,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn, formatFileSize, truncateFilename } from '@/lib/utils'

export interface FileItem {
  /** Unique identifier */
  id: string
  /** File name */
  name: string
  /** File size in bytes */
  size: number
  /** Number of pages (if available) */
  pageCount?: number
  /** Thumbnail data URL (if available) */
  thumbnail?: string
  /** Last modified date */
  modifiedAt?: Date
  /** Whether the file is currently selected */
  selected?: boolean
}

export interface FileGridProps {
  /** Array of files to display */
  files: FileItem[]
  /** Callback when a file is clicked */
  onFileClick?: (file: FileItem) => void
  /** Callback when a file is double-clicked */
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
  /** Additional CSS classes */
  className?: string
}

/**
 * Grid view component for displaying files as cards.
 * Shows thumbnails, file info, and action menus.
 *
 * @example
 * ```tsx
 * <FileGrid
 *   files={[
 *     { id: '1', name: 'document.pdf', size: 1024000, pageCount: 10 },
 *     { id: '2', name: 'report.pdf', size: 2048000, pageCount: 25 },
 *   ]}
 *   onFileClick={(file) => console.log('Clicked:', file)}
 *   onDownload={(file) => downloadFile(file)}
 *   onDelete={(file) => deleteFile(file)}
 * />
 * ```
 */
export const FileGrid = React.memo(function FileGrid({
  files,
  onFileClick,
  onFileDoubleClick,
  onFileSelect,
  onDownload,
  onDelete,
  onView,
  onEdit,
  multiSelect = false,
  className,
}: FileGridProps) {
  const handleClick = React.useCallback(
    (e: React.MouseEvent, file: FileItem) => {
      if (multiSelect && (e.ctrlKey || e.metaKey)) {
        onFileSelect?.(file, !file.selected)
      } else {
        onFileClick?.(file)
      }
    },
    [multiSelect, onFileClick, onFileSelect]
  )

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
    <div
      className={cn(
        'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
        className
      )}
    >
      <TooltipProvider>
        {files.map((file) => (
          <Card
            key={file.id}
            className={cn(
              'group relative cursor-pointer overflow-hidden transition-all hover:shadow-md',
              file.selected && 'ring-2 ring-primary'
            )}
            onClick={(e) => handleClick(e, file)}
            onDoubleClick={() => onFileDoubleClick?.(file)}
          >
            {/* Thumbnail */}
            <div className="aspect-[3/4] w-full bg-muted">
              {file.thumbnail ? (
                <img
                  src={file.thumbnail}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <FileText className="h-16 w-16 text-muted-foreground/30" />
                </div>
              )}
            </div>

            {/* Actions menu */}
            <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
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
            </div>

            {/* Selection indicator */}
            {multiSelect && (
              <div
                className={cn(
                  'absolute left-2 top-2 h-5 w-5 rounded-full border-2 transition-colors',
                  file.selected
                    ? 'border-primary bg-primary'
                    : 'border-white/50 bg-white/25 opacity-0 group-hover:opacity-100'
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
            )}

            {/* File info */}
            <div className="p-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="truncate text-sm font-medium">
                    {truncateFilename(file.name, 20)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{file.name}</p>
                </TooltipContent>
              </Tooltip>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatFileSize(file.size)}</span>
                {file.pageCount && (
                  <>
                    <span>|</span>
                    <span>
                      {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </TooltipProvider>
    </div>
  )
});
