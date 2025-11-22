/**
 * SignaturePanel - PDF signature tools component
 * Allows users to sign PDFs with drawn, typed, or image signatures
 */

import * as React from 'react'
import {
  PenTool,
  Type,
  Image,
  Loader2,
  Download,
  Trash2,
  RotateCcw,
  CheckCircle2,
  FileText,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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
  signPDF,
  getSignatures,
  type SignatureRect,
} from '@pdflover/pdf-core'
import type { ProgressInfo } from '@pdflover/shared'

/**
 * Signature canvas component for drawing signatures
 */
interface SignatureCanvasProps {
  width: number
  height: number
  onSignatureChange: (dataUrl: string | null) => void
  disabled?: boolean
}

function SignatureCanvas({ width, height, onSignatureChange, disabled }: SignatureCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = React.useState(false)
  const [hasDrawn, setHasDrawn] = React.useState(false)

  const getContext = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  const getCoordinates = React.useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current
      if (!canvas) return null

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height

      if ('touches' in e) {
        const touch = e.touches[0]
        if (!touch) return null
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        }
      }

      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    },
    []
  )

  const startDrawing = React.useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return
      e.preventDefault()

      const coords = getCoordinates(e)
      if (!coords) return

      const ctx = getContext()
      if (!ctx) return

      ctx.beginPath()
      ctx.moveTo(coords.x, coords.y)
      setIsDrawing(true)
    },
    [disabled, getCoordinates, getContext]
  )

  const draw = React.useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || disabled) return
      e.preventDefault()

      const coords = getCoordinates(e)
      if (!coords) return

      const ctx = getContext()
      if (!ctx) return

      ctx.lineTo(coords.x, coords.y)
      ctx.stroke()
      setHasDrawn(true)
    },
    [isDrawing, disabled, getCoordinates, getContext]
  )

  const stopDrawing = React.useCallback(() => {
    if (isDrawing && hasDrawn) {
      const canvas = canvasRef.current
      if (canvas) {
        onSignatureChange(canvas.toDataURL('image/png'))
      }
    }
    setIsDrawing(false)
  }, [isDrawing, hasDrawn, onSignatureChange])

  const clearCanvas = React.useCallback(() => {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    onSignatureChange(null)
  }, [getContext, onSignatureChange])

  // Initialize canvas
  React.useEffect(() => {
    const ctx = getContext()
    if (!ctx) return

    ctx.strokeStyle = '#000080'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [getContext])

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className={cn(
          'w-full border-2 border-dashed rounded-lg bg-white cursor-crosshair touch-none',
          disabled ? 'border-surface-300 opacity-50' : 'border-surface-400',
          hasDrawn && 'border-solid border-primary-500'
        )}
        style={{ aspectRatio: `${width}/${height}` }}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-surface-500">
          {hasDrawn ? 'Signature captured' : 'Draw your signature above'}
        </p>
        {hasDrawn && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCanvas}
            disabled={disabled}
            className="text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Props for SignaturePanel component
 */
export interface SignaturePanelProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * PDF Signature Panel component
 *
 * Features:
 * - Draw signature with canvas
 * - Type signature with custom text
 * - Upload signature image
 * - Signature placement options
 * - View existing signatures
 */
export function SignaturePanel({ className }: SignaturePanelProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const [activeTab, setActiveTab] = React.useState('draw')
  const { toast } = useToast()

  // Signature data
  const [drawnSignature, setDrawnSignature] = React.useState<string | null>(null)
  const [typedSignature, setTypedSignature] = React.useState('')
  const [uploadedSignature, setUploadedSignature] = React.useState<string | null>(null)
  const [signerName, setSignerName] = React.useState('')

  // Signature placement
  const [pageNumber, setPageNumber] = React.useState(1)
  const [signatureRect] = React.useState<SignatureRect>({
    x: 100,
    y: 100,
    width: 200,
    height: 50,
  })

  // Existing signatures
  const [existingSignatures, setExistingSignatures] = React.useState<Array<{
    signerName?: string
    signedDate?: Date
    pageNumber: number
  }>>([])

  /**
   * Handle PDF file selection
   */
  const handleFilesAccepted = React.useCallback(
    async (acceptedFiles: File[]) => {
      const selectedFile = acceptedFiles[0]
      if (!selectedFile) return

      setFile(selectedFile)

      // Check for existing signatures
      try {
        const buffer = await selectedFile.arrayBuffer()
        const signatures = await getSignatures(buffer)
        setExistingSignatures(signatures)

        if (signatures.length > 0) {
          toast({
            title: 'Signatures detected',
            description: `This PDF has ${signatures.length} existing signature(s)`,
          })
        }
      } catch {
        setExistingSignatures([])
      }

      toast({
        title: 'File selected',
        description: `Ready to sign ${selectedFile.name}`,
      })
    },
    [toast]
  )

  /**
   * Handle signature image upload
   */
  const handleImageUpload = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      try {
        const dataUrl = await readFileAsDataURL(files[0]!)
        setUploadedSignature(dataUrl)
        toast({
          title: 'Image loaded',
          description: 'Signature image ready to apply',
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
   * Get current signature data based on active tab
   */
  const getCurrentSignatureData = React.useCallback(() => {
    switch (activeTab) {
      case 'draw':
        return { type: 'drawn' as const, image: drawnSignature }
      case 'type':
        return { type: 'typed' as const, text: typedSignature }
      case 'upload':
        return { type: 'image' as const, image: uploadedSignature }
      default:
        return null
    }
  }, [activeTab, drawnSignature, typedSignature, uploadedSignature])

  /**
   * Apply signature to PDF
   */
  const handleSign = React.useCallback(async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a PDF file first',
        variant: 'destructive',
      })
      return
    }

    const signatureData = getCurrentSignatureData()
    if (!signatureData) {
      toast({
        title: 'No signature',
        description: 'Please create a signature first',
        variant: 'destructive',
      })
      return
    }

    if (signatureData.type === 'drawn' && !signatureData.image) {
      toast({
        title: 'No signature drawn',
        description: 'Please draw your signature',
        variant: 'destructive',
      })
      return
    }

    if (signatureData.type === 'typed' && !signatureData.text?.trim()) {
      toast({
        title: 'No signature text',
        description: 'Please enter your signature',
        variant: 'destructive',
      })
      return
    }

    if (signatureData.type === 'image' && !signatureData.image) {
      toast({
        title: 'No signature image',
        description: 'Please upload a signature image',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting...')

    try {
      const buffer = await file.arrayBuffer()
      const result = await signPDF({
        document: buffer,
        signatureType: signatureData.type,
        signatureImage: signatureData.type !== 'typed' ? signatureData.image ?? undefined : undefined,
        signatureText: signatureData.type === 'typed' ? signatureData.text : undefined,
        pageNumber,
        rect: signatureRect,
        signerName: signerName || undefined,
        onProgress: handleProgress,
      })

      if (result.success && result.data) {
        const blob = arrayBufferToBlob(result.data, 'application/pdf')
        const filename = file.name.replace('.pdf', '_signed.pdf')
        downloadBlob(blob, filename)

        toast({
          title: 'Document signed',
          description: `Successfully signed ${file.name}`,
        })
      } else {
        throw new Error(result.error ?? 'Failed to sign PDF')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Signing failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [file, getCurrentSignatureData, pageNumber, signatureRect, signerName, handleProgress, toast])

  /**
   * Check if signature is ready
   */
  const isSignatureReady = React.useMemo(() => {
    switch (activeTab) {
      case 'draw':
        return !!drawnSignature
      case 'type':
        return !!typedSignature.trim()
      case 'upload':
        return !!uploadedSignature
      default:
        return false
    }
  }, [activeTab, drawnSignature, typedSignature, uploadedSignature])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="h-5 w-5 text-blue-500" />
          Sign PDF
        </CardTitle>
        <CardDescription>
          Add your signature to PDF documents. Draw, type, or upload your signature.
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
                setExistingSignatures([])
              }}
              disabled={isProcessing}
            >
              Change
            </Button>
          </div>
        )}

        {/* Existing Signatures */}
        {existingSignatures.length > 0 && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Existing Signatures ({existingSignatures.length})
              </p>
            </div>
            <ul className="space-y-1">
              {existingSignatures.map((sig, index) => (
                <li key={index} className="text-xs text-blue-600 dark:text-blue-400">
                  {sig.signerName ?? 'Unknown'} - Page {sig.pageNumber}
                  {sig.signedDate && ` - ${new Date(sig.signedDate).toLocaleDateString()}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Signature Type Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="draw" className="flex items-center gap-2">
              <PenTool className="h-4 w-4" />
              Draw
            </TabsTrigger>
            <TabsTrigger value="type" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Type
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Upload
            </TabsTrigger>
          </TabsList>

          {/* Draw Tab */}
          <TabsContent value="draw" className="space-y-4 mt-4">
            <SignatureCanvas
              width={400}
              height={150}
              onSignatureChange={setDrawnSignature}
              disabled={isProcessing}
            />
          </TabsContent>

          {/* Type Tab */}
          <TabsContent value="type" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Type Your Signature
              </label>
              <Input
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                placeholder="Enter your name"
                disabled={isProcessing}
                className="text-xl font-serif italic"
              />
            </div>
            {typedSignature && (
              <div className="p-4 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                <p className="text-xs text-surface-500 mb-2">Preview:</p>
                <p
                  className="text-2xl font-serif italic text-blue-800 dark:text-blue-300"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {typedSignature}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-4 mt-4">
            {uploadedSignature ? (
              <div className="space-y-3">
                <div className="p-4 bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                  <p className="text-xs text-surface-500 mb-2">Preview:</p>
                  <img
                    src={uploadedSignature}
                    alt="Signature preview"
                    className="max-w-full max-h-32 object-contain"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setUploadedSignature(null)}
                  disabled={isProcessing}
                  className="w-full"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Change Image
                </Button>
              </div>
            ) : (
              <div
                className={cn(
                  'border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 transition-colors',
                  isProcessing && 'opacity-50 cursor-not-allowed'
                )}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleImageUpload}
                  disabled={isProcessing}
                  className="hidden"
                  id="signature-image-input"
                />
                <label
                  htmlFor="signature-image-input"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Image className="h-10 w-10 text-surface-400 mb-3" />
                  <p className="text-sm text-surface-600 dark:text-surface-400">
                    Click to upload signature image
                  </p>
                  <p className="text-xs text-surface-400 mt-1">
                    PNG or JPG with transparent background works best
                  </p>
                </label>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Signer Information */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Signer Name (optional)
          </label>
          <Input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Enter your full name"
            disabled={isProcessing}
          />
        </div>

        {/* Page Number */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Page Number
          </label>
          <Input
            type="number"
            value={pageNumber}
            onChange={(e) => setPageNumber(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            disabled={isProcessing}
          />
          <p className="text-xs text-surface-500">
            The page where the signature will be placed
          </p>
        </div>

        {/* Sign Button */}
        <Button
          onClick={handleSign}
          disabled={!file || !isSignatureReady || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Signing...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Sign & Download
            </>
          )}
        </Button>

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
