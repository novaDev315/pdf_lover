import * as React from 'react'
import { useDropzone, type Accept, type FileRejection } from 'react-dropzone'
import { Upload, FileText, AlertCircle, ShieldCheck } from 'lucide-react'

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
  const helpId = React.useId()
  const [error, setError] = React.useState<string | null>(null)
  const pdfOnly = Object.keys(accept).every((type) =>
    type === 'application/pdf' || type === 'application/x-pdf'
  )
  const acceptedExtensions = React.useMemo(() => {
    const extensions = Object.values(accept).flat().filter(Boolean)
    if (extensions.length === 0) return 'Selected file types'
    return extensions.map((extension) => extension.toUpperCase()).join(', ')
  }, [accept])

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
        role="button"
        aria-label={multiple ? 'Add files' : 'Add a file'}
        aria-describedby={children ? undefined : helpId}
        aria-disabled={disabled}
        className={cn(
          'group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed p-6 text-center transition-[border-color,background-color,box-shadow] duration-200',
          isDragActive && 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_hsl(var(--primary))]',
          isDragAccept && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950',
          isDragReject && 'border-red-500 bg-red-50 dark:bg-red-950',
          !isDragActive && 'border-surface-300 bg-surface-50/60 hover:border-primary/50 hover:bg-primary/5 dark:border-surface-700 dark:bg-surface-900/40',
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
          <div className="flex max-w-md flex-col items-center gap-4">
            <div
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-2xl border bg-card shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5',
                isDragReject && 'border-red-200 text-red-500 dark:border-red-900',
                isDragAccept && 'border-emerald-200 text-emerald-600 dark:border-emerald-900',
                !isDragActive && 'border-surface-200 text-primary dark:border-surface-700',
              )}
            >
              {isDragReject ? (
                <AlertCircle className="h-7 w-7" aria-hidden="true" />
              ) : isDragAccept ? (
                <FileText className="h-7 w-7" aria-hidden="true" />
              ) : (
                <Upload className="h-7 w-7" aria-hidden="true" />
              )}
            </div>

            <div className={cn(
              'flex flex-col items-center gap-1.5',
              disabled && 'cursor-not-allowed opacity-50',
              isDragActive && 'border-primary',
            )}>
              <p className="text-base font-semibold text-surface-950 dark:text-white sm:text-lg">
                {isDragActive
                  ? isDragReject
                    ? 'Invalid file type'
                    : 'Drop your files here'
                  : `Drag & drop ${pdfOnly ? 'PDF ' : ''}${multiple ? 'files' : 'a file'}`}
              </p>
              <p id={helpId} className="text-sm text-muted-foreground">
                or <span className="font-medium text-primary group-hover:underline">choose from your device</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{acceptedExtensions}</span>
              <span aria-hidden="true">·</span>
              <span>Up to {formatFileSize(maxSize)}</span>
              {maxFiles !== Infinity && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Max {maxFiles} {maxFiles === 1 ? 'file' : 'files'}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Processing details are shown before you continue
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <pre className="whitespace-pre-wrap font-sans">{error}</pre>
        </div>
      )}
    </div>
  )
}
