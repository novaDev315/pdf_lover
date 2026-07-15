/**
 * SecurityPanel - PDF security tools component
 * Allows users to encrypt/decrypt PDFs and manage permissions
 */

import * as React from 'react'
import {
  Lock,
  Unlock,
  Shield,
  ShieldCheck,
  ShieldX,
  Eye,
  EyeOff,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
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
} from '@/lib/utils'
import {
  getSecurityInfo,
  type EncryptionLevel,
  type PDFPermissions,
  type PDFSecurityInfo,
} from '@pdflover/pdf-core'
import type { ProgressInfo } from '@pdflover/shared'
import { runServerPdfOperation } from '@/lib/api'

/**
 * Checkbox component for permissions
 */
interface PermissionCheckboxProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

function PermissionCheckbox({
  label,
  description,
  checked,
  onChange,
  disabled,
}: PermissionCheckboxProps) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
        checked
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
          : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
      />
      <div>
        <p className="text-sm font-medium text-surface-900 dark:text-white">{label}</p>
        <p className="text-xs text-surface-500 dark:text-surface-400">{description}</p>
      </div>
    </label>
  )
}

/**
 * Props for SecurityPanel component
 */
export interface SecurityPanelProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * PDF Security Panel component
 *
 * Features:
 * - Password protection (encrypt/decrypt)
 * - Encryption level selection (128/256-bit AES)
 * - Permission management
 * - Security status display
 */
export function SecurityPanel({ className }: SecurityPanelProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const [activeTab, setActiveTab] = React.useState('encrypt')
  const { toast } = useToast()

  // Encryption settings
  const [userPassword, setUserPassword] = React.useState('')
  const [ownerPassword, setOwnerPassword] = React.useState('')
  const [encryptionLevel, setEncryptionLevel] = React.useState<EncryptionLevel>('256-AES')
  const [showUserPassword, setShowUserPassword] = React.useState(false)
  const [showOwnerPassword, setShowOwnerPassword] = React.useState(false)

  // Decryption settings
  const [decryptPassword, setDecryptPassword] = React.useState('')
  const [showDecryptPassword, setShowDecryptPassword] = React.useState(false)

  // Permissions
  const [permissions, setPermissions] = React.useState<PDFPermissions>({
    printing: true,
    copying: false,
    modifying: false,
    annotating: true,
    fillingForms: true,
    contentAccessibility: true,
    documentAssembly: false,
    highQualityPrint: true,
  })

  // Security info
  const [securityInfo, setSecurityInfo] = React.useState<PDFSecurityInfo | null>(null)

  /**
   * Handle file selection
   */
  const handleFilesAccepted = React.useCallback(
    async (acceptedFiles: File[]) => {
      const selectedFile = acceptedFiles[0]
      if (!selectedFile) return

      setFile(selectedFile)

      // Check security status
      try {
        const buffer = await selectedFile.arrayBuffer()
        const info = await getSecurityInfo(buffer)
        setSecurityInfo(info)

        if (info.isEncrypted) {
          setActiveTab('decrypt')
          toast({
            title: 'Encrypted PDF detected',
            description: 'This PDF is password protected. Switch to the Decrypt tab to remove protection.',
          })
        }
      } catch {
        setSecurityInfo(null)
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
   * Update a single permission
   */
  const updatePermission = React.useCallback(
    (key: keyof PDFPermissions, value: boolean) => {
      setPermissions((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  /**
   * Encrypt the PDF
   */
  const handleEncrypt = React.useCallback(async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a PDF file first',
        variant: 'destructive',
      })
      return
    }

    if (!ownerPassword) {
      toast({
        title: 'Owner password required',
        description: 'Please enter an owner password to protect the document',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting encryption...')

    try {
      const [result] = await runServerPdfOperation({
        operation: 'pdf.encrypt',
        file,
        options: {
        userPassword: userPassword || undefined,
        ownerPassword,
        encryptionLevel,
        permissions,
        },
        onProgress: handleProgress,
      })

      if (result) {
        downloadBlob(new Blob([result.data], { type: result.mediaType }), result.filename)

        toast({
          title: 'Encryption complete',
          description: `Successfully protected ${file.name} (${formatFileSize(result.data.byteLength)})`,
        })

        // Reset form
        setFile(null)
        setUserPassword('')
        setOwnerPassword('')
        setSecurityInfo(null)
      } else throw new Error('The server returned no encrypted PDF')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Encryption failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [file, userPassword, ownerPassword, encryptionLevel, permissions, handleProgress, toast])

  /**
   * Decrypt the PDF
   */
  const handleDecrypt = React.useCallback(async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select an encrypted PDF file first',
        variant: 'destructive',
      })
      return
    }

    if (!decryptPassword) {
      toast({
        title: 'Password required',
        description: 'Please enter the password to decrypt the document',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setProgressStage('Starting decryption...')

    try {
      const [result] = await runServerPdfOperation({
        operation: 'pdf.decrypt',
        file,
        options: { userPassword: decryptPassword },
        onProgress: handleProgress,
      })

      if (result) {
        downloadBlob(new Blob([result.data], { type: result.mediaType }), result.filename)

        toast({
          title: 'Decryption complete',
          description: `Successfully unlocked ${file.name}`,
        })

        // Reset form
        setFile(null)
        setDecryptPassword('')
        setSecurityInfo(null)
      } else throw new Error('The server returned no decrypted PDF')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({
        title: 'Decryption failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [file, decryptPassword, handleProgress, toast])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" />
          PDF Security
        </CardTitle>
        <CardDescription>
          Protect your PDFs with password encryption or remove existing protection.
          Files are sent to your PDFLover backend only when you start this server-only operation.
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

        {/* Security Status */}
        {file && securityInfo && (
          <div
            className={cn(
              'flex items-center gap-3 p-4 rounded-lg border',
              securityInfo.isEncrypted
                ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
                : 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
            )}
          >
            {securityInfo.isEncrypted ? (
              <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <ShieldX className="h-5 w-5 text-green-600 dark:text-green-400" />
            )}
            <div>
              <p className="text-sm font-medium text-surface-900 dark:text-white">
                {securityInfo.isEncrypted ? 'Encrypted PDF' : 'Unprotected PDF'}
              </p>
              <p className="text-xs text-surface-600 dark:text-surface-400">
                {securityInfo.isEncrypted
                  ? `Password protected${securityInfo.hasUserPassword ? ' (requires password to open)' : ''}`
                  : 'No password protection applied'}
              </p>
            </div>
          </div>
        )}

        {/* Selected File Info */}
        {file && (
          <div className="flex items-center gap-3 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
            <Lock className="h-5 w-5 text-surface-500" />
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
                setSecurityInfo(null)
              }}
              disabled={isProcessing}
            >
              Change
            </Button>
          </div>
        )}

        {/* Tabs for Encrypt/Decrypt */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="encrypt" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Encrypt
            </TabsTrigger>
            <TabsTrigger value="decrypt" className="flex items-center gap-2">
              <Unlock className="h-4 w-4" />
              Decrypt
            </TabsTrigger>
          </TabsList>

          {/* Encrypt Tab */}
          <TabsContent value="encrypt" className="space-y-4 mt-4">
            {/* Encryption Level */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Encryption Level
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEncryptionLevel('128-AES')}
                  disabled={isProcessing}
                  className={cn(
                    'p-3 rounded-lg border text-sm font-medium transition-colors',
                    encryptionLevel === '128-AES'
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/20 dark:text-primary-300'
                      : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                  )}
                >
                  128-bit AES
                  <p className="text-xs font-normal text-surface-500 mt-1">Standard security</p>
                </button>
                <button
                  type="button"
                  onClick={() => setEncryptionLevel('256-AES')}
                  disabled={isProcessing}
                  className={cn(
                    'p-3 rounded-lg border text-sm font-medium transition-colors',
                    encryptionLevel === '256-AES'
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/20 dark:text-primary-300'
                      : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                  )}
                >
                  256-bit AES
                  <p className="text-xs font-normal text-surface-500 mt-1">Maximum security</p>
                </button>
              </div>
            </div>

            {/* User Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                User Password (optional)
              </label>
              <p className="text-xs text-surface-500">
                Required to open the document. Leave empty if no password should be required to view.
              </p>
              <div className="relative">
                <Input
                  type={showUserPassword ? 'text' : 'password'}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="Enter user password"
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={() => setShowUserPassword(!showUserPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Owner Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Owner Password (required)
              </label>
              <p className="text-xs text-surface-500">
                Required to change permissions and remove protection.
              </p>
              <div className="relative">
                <Input
                  type={showOwnerPassword ? 'text' : 'password'}
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Enter owner password"
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showOwnerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Document Permissions
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PermissionCheckbox
                  label="Printing"
                  description="Allow printing the document"
                  checked={permissions.printing}
                  onChange={(checked) => updatePermission('printing', checked)}
                  disabled={isProcessing}
                />
                <PermissionCheckbox
                  label="Copying"
                  description="Allow copying text and graphics"
                  checked={permissions.copying}
                  onChange={(checked) => updatePermission('copying', checked)}
                  disabled={isProcessing}
                />
                <PermissionCheckbox
                  label="Modifying"
                  description="Allow editing the document"
                  checked={permissions.modifying}
                  onChange={(checked) => updatePermission('modifying', checked)}
                  disabled={isProcessing}
                />
                <PermissionCheckbox
                  label="Annotating"
                  description="Allow adding comments and annotations"
                  checked={permissions.annotating}
                  onChange={(checked) => updatePermission('annotating', checked)}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Encrypt Button */}
            <Button
              onClick={handleEncrypt}
              disabled={!file || !ownerPassword || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Encrypting...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Protect PDF
                </>
              )}
            </Button>
          </TabsContent>

          {/* Decrypt Tab */}
          <TabsContent value="decrypt" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Password
              </label>
              <p className="text-xs text-surface-500">
                Enter the password used to protect this document.
              </p>
              <div className="relative">
                <Input
                  type={showDecryptPassword ? 'text' : 'password'}
                  value={decryptPassword}
                  onChange={(e) => setDecryptPassword(e.target.value)}
                  placeholder="Enter document password"
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={() => setShowDecryptPassword(!showDecryptPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showDecryptPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Decrypt Button */}
            <Button
              onClick={handleDecrypt}
              disabled={!file || !decryptPassword || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Decrypting...
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Remove Protection
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

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
