import * as React from 'react'
import { useDropzone, type Accept, type FileRejection } from 'react-dropzone'
import { Upload, FileText, AlertCircle } from 'lucide-react'

import { cn, formatFileSize, isPdfFile } from '@/lib/utils'

export interface FileDropzoneProps {
  /** Callback when files are accepted */
  onFilesAccepted: (files: File[]) => void
  /** Callback when files are rejected */
  onFilesRejected?: (rejections: FileRejection[]) => void
  /** Accepted file types (defaults to PDF only) */
  accept?: Accept
  /** Maximum number of files */
  maxFiles?: number
  /** Maximum file size in bytes */
  maxSize?: number
  /** Whether multiple files can be selected */
  multiple?: boolean
  /** Whether the dropzone is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
  /** Custom content to render inside the dropzone */
  children?: React.ReactNode
}

/**
 * Drag and drop file upload component.
 * Supports PDF files by default with customizable validation.
 *
 * @example
 * ```tsx
 * <FileDropzone
 *   onFilesAccepted={(files) => console.log('Accepted:', files)}
 *   onFilesRejected={(rejections) => console.error('Rejected:', rejections)}
 *   maxFiles={10}
 *   maxSize={200 * 1024 * 1024} // 200MB
 * />
 * ```
 */
export function FileDropzone({
  onFilesAccepted,
  onFilesRejected,
  accept = { 'application/pdf': ['.pdf'] },
  maxFiles = 100,
  maxSize = 200 * 1024 * 1024, // 200MB default
  multiple = true,
  disabled = false,
  className,
  children,
}: FileDropzoneProps) {
  const [error, setError] = React.useState<string | null>(null)
  const pdfOnly = Object.keys(accept).every((type) =>
    type === 'application/pdf' || type === 'application/x-pdf'
  )

  const onDrop = React.useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setError(null)

      if (fileRejections.length > 0) {
        const errors = fileRejections.map((rejection) => {
          const errorMessages = rejection.errors
            .map((err) => {
              switch (err.code) {
                case 'file-too-large':
                  return `File too large (max ${formatFileSize(maxSize)})`
                case 'file-invalid-type':
                  return 'Invalid file type (PDF only)'
                case 'too-many-files':
                  return `Too many files (max ${maxFiles})`
                default:
                  return err.message
              }
            })
            .join(', ')
          return `${rejection.file.name}: ${errorMessages}`
        })
        setError(errors.join('\n'))
        onFilesRejected?.(fileRejections)
      }

      if (acceptedFiles.length > 0) {
        // Additional validation for PDF files
        const validFiles = acceptedFiles.filter((file) => {
          if (!pdfOnly) return true
          if (!isPdfFile(file)) {
            setError((prev) =>
              prev
                ? `${prev}\n${file.name}: Not a valid PDF file`
                : `${file.name}: Not a valid PDF file`
            )
            return false
          }
          return true
        })

        if (validFiles.length > 0) {
          onFilesAccepted(validFiles)
        }
      }
    },
    [maxFiles, maxSize, onFilesAccepted, onFilesRejected, pdfOnly]
  )

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize,
    multiple,
    disabled,
  })

  const validateInputCapture = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!pdfOnly || !event.target.files) return
      const invalid = Array.from(event.target.files).filter((file) => !isPdfFile(file))
      if (invalid.length === 0) return
      event.stopPropagation()
      const rejections: FileRejection[] = invalid.map((file) => ({
        file,
        errors: [{ code: 'file-invalid-type', message: 'Invalid file type (PDF only)' }],
      }))
      setError(rejections.map((item) => `${item.file.name}: Invalid file type (PDF only)`).join('\n'))
      onFilesRejected?.(rejections)
    },
    [onFilesRejected, pdfOnly],
  )

  return (
    <div className={cn('w-full', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
          isDragActive && 'border-primary bg-primary/5',
          isDragAccept && 'border-green-500 bg-green-50 dark:bg-green-950',
          isDragReject && 'border-red-500 bg-red-50 dark:bg-red-950',
          !isDragActive && 'border-muted-foreground/25 hover:border-primary/50',
          disabled && 'cursor-not-allowed opacity-50',
          error && 'border-red-500'
        )}
      >
        <input
          {...getInputProps()}
          disabled={disabled}
          onChangeCapture={validateInputCapture}
        />

        {children ? (
          children
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            {isDragReject ? (
              <AlertCircle className="h-12 w-12 text-red-500" />
            ) : isDragAccept ? (
              <FileText className="h-12 w-12 text-green-500" />
            ) : (
              <Upload
                className={cn(
                  'h-12 w-12',
                  isDragActive ? 'text-primary' : 'text-muted-foreground'
                )}
              />
            )}

            <div className={cn(
              'space-y-2',
              disabled && 'cursor-not-allowed opacity-50',
              isDragActive && 'border-primary',
            )}>
              <p className="text-lg font-medium">
                {isDragActive
                  ? isDragReject
                    ? 'Invalid file type'
                    : 'Drop your files here'
                  : 'Drag & drop your PDF files here'}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse files
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-1">
                Accepted: .pdf
              </span>
              <span className="rounded-full bg-muted px-2 py-1">
                Max {formatFileSize(maxSize)}
              </span>
              {maxFiles !== Infinity && (
                <span className="rounded-full bg-muted px-2 py-1">
                  Max {maxFiles} files
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <pre className="whitespace-pre-wrap font-sans">{error}</pre>
        </div>
      )}
    </div>
  )
}
