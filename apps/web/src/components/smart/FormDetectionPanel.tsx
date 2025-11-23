/**
 * FormDetectionPanel - Smart form field detection component
 *
 * Provides UI for automatic form field detection in PDF documents
 * with visual overlay, field editing, and fillable PDF creation.
 */

import * as React from 'react'
import {
  FileSearch,
  Loader2,
  Download,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  Plus,
  CheckSquare,
  Type,
  Calendar,
  Mail,
  Phone,
  Hash,
  PenTool,
  AlignLeft,
  ChevronDown,
  CircleDot,
  FileText,
  Settings2,
  RefreshCw,
  Layers,
  Check,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { useToast } from '@/hooks/use-toast'
import {
  cn,
  formatFileSize,
  downloadBlob,
  arrayBufferToBlob,
} from '@/lib/utils'
import {
  detectFormFields,
  analyzeFormStructure,
  createFormFields,
  type DetectedField,
  type FormFieldType,
  type FormStructure,
  type FieldBounds,
} from '@pdflover/pdf-core'
import type { ProgressInfo } from '@pdflover/shared'

/**
 * Field type configuration for display
 */
const FIELD_TYPE_CONFIG: Record<FormFieldType, { label: string; icon: React.ReactNode; color: string }> = {
  text: { label: 'Text', icon: <Type className="h-4 w-4" />, color: 'bg-blue-500' },
  checkbox: { label: 'Checkbox', icon: <CheckSquare className="h-4 w-4" />, color: 'bg-green-500' },
  radio: { label: 'Radio', icon: <CircleDot className="h-4 w-4" />, color: 'bg-purple-500' },
  dropdown: { label: 'Dropdown', icon: <ChevronDown className="h-4 w-4" />, color: 'bg-orange-500' },
  signature: { label: 'Signature', icon: <PenTool className="h-4 w-4" />, color: 'bg-red-500' },
  date: { label: 'Date', icon: <Calendar className="h-4 w-4" />, color: 'bg-cyan-500' },
  email: { label: 'Email', icon: <Mail className="h-4 w-4" />, color: 'bg-indigo-500' },
  phone: { label: 'Phone', icon: <Phone className="h-4 w-4" />, color: 'bg-pink-500' },
  number: { label: 'Number', icon: <Hash className="h-4 w-4" />, color: 'bg-amber-500' },
  textarea: { label: 'Text Area', icon: <AlignLeft className="h-4 w-4" />, color: 'bg-teal-500' },
}

/**
 * Available field types for selection
 */
const FIELD_TYPES: FormFieldType[] = [
  'text',
  'checkbox',
  'radio',
  'dropdown',
  'signature',
  'date',
  'email',
  'phone',
  'number',
  'textarea',
]

/**
 * Field item component for the detected fields list
 */
interface FieldItemProps {
  field: DetectedField
  isSelected: boolean
  showOverlay: boolean
  onSelect: () => void
  onDelete: () => void
  onUpdate: (updates: Partial<DetectedField>) => void
  onToggleOverlay: () => void
}

function FieldItem({
  field,
  isSelected,
  showOverlay,
  onSelect,
  onDelete,
  onUpdate,
  onToggleOverlay,
}: FieldItemProps) {
  const config = FIELD_TYPE_CONFIG[field.type]
  const [isEditing, setIsEditing] = React.useState(false)
  const [editLabel, setEditLabel] = React.useState(field.label)
  const [editName, setEditName] = React.useState(field.name)

  const handleSave = () => {
    onUpdate({ label: editLabel, name: editName })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditLabel(field.label)
    setEditName(field.name)
    setIsEditing(false)
  }

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-colors cursor-pointer',
        isSelected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
          : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        {/* Field type indicator */}
        <div
          className={cn(
            'p-1.5 rounded text-white flex-shrink-0',
            config.color
          )}
        >
          {config.icon}
        </div>

        {/* Field info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Field label"
                className="h-7 text-sm"
              />
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Field name"
                className="h-7 text-sm"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handleSave}>
                  <Check className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handleCancel}>
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                {field.label}
              </p>
              <p className="text-xs text-surface-500 truncate">
                {field.name} - Page {field.page}
              </p>
            </>
          )}
        </div>

        {/* Confidence badge */}
        <div
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0',
            field.confidence >= 70
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : field.confidence >= 40
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          )}
        >
          {Math.round(field.confidence)}%
        </div>
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-surface-100 dark:border-surface-800">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleOverlay()
                  }}
                >
                  {showOverlay ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showOverlay ? 'Hide overlay' : 'Show overlay'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsEditing(true)
                  }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit field</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-red-500 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete field</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Field type selector */}
          <div className="flex-1" />
          <Select
            value={field.type}
            onValueChange={(value) => onUpdate({ type: value as FormFieldType })}
          >
            <SelectTrigger
              className="h-7 w-28 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="text-xs">
                  <span className="flex items-center gap-2">
                    {FIELD_TYPE_CONFIG[type].icon}
                    {FIELD_TYPE_CONFIG[type].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Required indicator */}
      {field.required && (
        <div className="mt-2 text-xs text-red-500 flex items-center gap-1">
          <span>*</span>
          Required field
        </div>
      )}
    </div>
  )
}

/**
 * Props for FormDetectionPanel component
 */
export interface FormDetectionPanelProps {
  /** Additional CSS classes */
  className?: string
  /** Initial PDF file */
  initialFile?: File
  /** Callback when fields are detected */
  onFieldsDetected?: (fields: DetectedField[]) => void
  /** Callback when fillable PDF is created */
  onFillableCreated?: (buffer: ArrayBuffer) => void
}

/**
 * FormDetectionPanel component
 *
 * Features:
 * - Upload PDF for form field detection
 * - Auto-detect text fields, checkboxes, signatures, dates
 * - Visual overlay showing detected fields
 * - Edit field properties (type, name, required)
 * - Adjust field boundaries
 * - Group related fields
 * - Export as fillable PDF
 */
export function FormDetectionPanel({
  className,
  initialFile,
  onFieldsDetected,
  onFillableCreated,
}: FormDetectionPanelProps) {
  const [file, setFile] = React.useState<File | null>(initialFile ?? null)
  const [pdfBuffer, setPdfBuffer] = React.useState<ArrayBuffer | null>(null)
  const [isDetecting, setIsDetecting] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [progressStage, setProgressStage] = React.useState('')
  const { toast } = useToast()

  // Detection results
  const [formStructure, setFormStructure] = React.useState<FormStructure | null>(null)
  const [detectedFields, setDetectedFields] = React.useState<DetectedField[]>([])
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null)
  const [visibleFieldIds, setVisibleFieldIds] = React.useState<Set<string>>(new Set())

  // Detection settings
  const [sensitivity, setSensitivity] = React.useState(50)
  const [minConfidence, setMinConfidence] = React.useState(30)
  const [detectText, setDetectText] = React.useState(true)
  const [detectCheckboxes, setDetectCheckboxes] = React.useState(true)
  const [detectSignatures, setDetectSignatures] = React.useState(true)
  const [detectDates, setDetectDates] = React.useState(true)

  // Active tab
  const [activeTab, setActiveTab] = React.useState('fields')

  /**
   * Handle file selection
   */
  const handleFilesAccepted = React.useCallback(
    async (acceptedFiles: File[]) => {
      const selectedFile = acceptedFiles[0]
      if (!selectedFile) return

      setFile(selectedFile)
      setDetectedFields([])
      setFormStructure(null)
      setSelectedFieldId(null)
      setVisibleFieldIds(new Set())

      try {
        const buffer = await selectedFile.arrayBuffer()
        setPdfBuffer(buffer)
        toast({
          title: 'PDF loaded',
          description: 'Ready to detect form fields',
        })
      } catch {
        toast({
          title: 'Failed to load PDF',
          description: 'Please try a different file',
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
   * Detect form fields
   */
  const handleDetect = React.useCallback(async () => {
    if (!pdfBuffer) {
      toast({
        title: 'No file selected',
        description: 'Please upload a PDF file first',
        variant: 'destructive',
      })
      return
    }

    setIsDetecting(true)
    setProgress(0)
    setProgressStage('Starting detection...')

    try {
      const structure = await analyzeFormStructure(pdfBuffer, {
        sensitivity,
        minConfidence,
        detectText,
        detectCheckboxes,
        detectSignatures,
        detectDates,
        onProgress: handleProgress,
      })

      setFormStructure(structure)
      setDetectedFields(structure.fields)
      setVisibleFieldIds(new Set(structure.fields.map((f) => f.id)))
      onFieldsDetected?.(structure.fields)

      if (structure.fields.length > 0) {
        toast({
          title: 'Detection complete',
          description: `Found ${structure.fields.length} form field(s)`,
        })
      } else {
        toast({
          title: 'No fields detected',
          description: 'Try adjusting the sensitivity settings',
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Detection failed'
      toast({
        title: 'Detection failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsDetecting(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [
    pdfBuffer,
    sensitivity,
    minConfidence,
    detectText,
    detectCheckboxes,
    detectSignatures,
    detectDates,
    handleProgress,
    onFieldsDetected,
    toast,
  ])

  /**
   * Create fillable PDF
   */
  const handleCreateFillable = React.useCallback(async () => {
    if (!pdfBuffer || detectedFields.length === 0) {
      toast({
        title: 'No fields to create',
        description: 'Please detect form fields first',
        variant: 'destructive',
      })
      return
    }

    setIsCreating(true)
    setProgress(0)
    setProgressStage('Creating fillable PDF...')

    try {
      const result = await createFormFields({
        document: pdfBuffer,
        fields: detectedFields,
        onProgress: handleProgress,
      })

      if (result.success && result.data) {
        const blob = arrayBufferToBlob(result.data, 'application/pdf')
        const filename = file?.name.replace('.pdf', '_fillable.pdf') ?? 'fillable-form.pdf'
        downloadBlob(blob, filename)
        onFillableCreated?.(result.data)

        toast({
          title: 'Fillable PDF created',
          description: `Successfully created ${filename}`,
        })
      } else {
        throw new Error(result.error ?? 'Failed to create fillable PDF')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Creation failed'
      toast({
        title: 'Creation failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
      setProgress(0)
      setProgressStage('')
    }
  }, [pdfBuffer, detectedFields, file, handleProgress, onFillableCreated, toast])

  /**
   * Update a field
   */
  const handleUpdateField = React.useCallback((fieldId: string, updates: Partial<DetectedField>) => {
    setDetectedFields((prev) =>
      prev.map((field) =>
        field.id === fieldId ? { ...field, ...updates } : field
      )
    )
  }, [])

  /**
   * Delete a field
   */
  const handleDeleteField = React.useCallback((fieldId: string) => {
    setDetectedFields((prev) => prev.filter((field) => field.id !== fieldId))
    setVisibleFieldIds((prev) => {
      const next = new Set(prev)
      next.delete(fieldId)
      return next
    })
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null)
    }
  }, [selectedFieldId])

  /**
   * Toggle field overlay visibility
   */
  const handleToggleOverlay = React.useCallback((fieldId: string) => {
    setVisibleFieldIds((prev) => {
      const next = new Set(prev)
      if (next.has(fieldId)) {
        next.delete(fieldId)
      } else {
        next.add(fieldId)
      }
      return next
    })
  }, [])

  /**
   * Add a new manual field
   */
  const handleAddField = React.useCallback(() => {
    const newField: DetectedField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: 'text',
      label: 'New Field',
      bounds: {
        x: 100,
        y: 100,
        width: 200,
        height: 25,
      },
      page: 1,
      confidence: 100,
      name: 'new_field',
      required: false,
    }

    setDetectedFields((prev) => [...prev, newField])
    setVisibleFieldIds((prev) => new Set([...prev, newField.id]))
    setSelectedFieldId(newField.id)
  }, [])

  const isProcessing = isDetecting || isCreating
  const selectedField = detectedFields.find((f) => f.id === selectedFieldId)

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-primary-500" />
          Form Field Detection
        </CardTitle>
        <CardDescription>
          Automatically detect form fields in PDF documents and convert them to fillable forms.
          All processing happens locally in your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Upload PDF
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
                setPdfBuffer(null)
                setDetectedFields([])
                setFormStructure(null)
              }}
              disabled={isProcessing}
            >
              Change
            </Button>
          </div>
        )}

        {/* Form Structure Info */}
        {formStructure && (
          <div
            className={cn(
              'p-4 rounded-lg border',
              formStructure.isForm
                ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4" />
              <p className="text-sm font-medium">
                {formStructure.isForm
                  ? `Form detected (${Math.round(formStructure.formConfidence)}% confidence)`
                  : 'Document may not be a form'}
              </p>
            </div>
            <div className="text-xs space-y-1">
              <p>Pages: {formStructure.pageCount}</p>
              <p>Fields detected: {formStructure.fields.length}</p>
              <p>Field groups: {formStructure.groups.length}</p>
              {formStructure.formTitle && <p>Form title: {formStructure.formTitle}</p>}
            </div>
          </div>
        )}

        {/* Tabs for Fields and Settings */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fields" className="flex items-center gap-2">
              <FileSearch className="h-4 w-4" />
              Fields ({detectedFields.length})
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Fields Tab */}
          <TabsContent value="fields" className="space-y-4 mt-4">
            {/* Detection Button */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDetect}
                disabled={!pdfBuffer || isProcessing}
                className="flex-1"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <FileSearch className="h-4 w-4 mr-2" />
                    Detect Form Fields
                  </>
                )}
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleAddField}
                      disabled={isProcessing || !pdfBuffer}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add field manually</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Fields List */}
            {detectedFields.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {detectedFields.map((field) => (
                  <FieldItem
                    key={field.id}
                    field={field}
                    isSelected={field.id === selectedFieldId}
                    showOverlay={visibleFieldIds.has(field.id)}
                    onSelect={() => setSelectedFieldId(field.id)}
                    onDelete={() => handleDeleteField(field.id)}
                    onUpdate={(updates) => handleUpdateField(field.id, updates)}
                    onToggleOverlay={() => handleToggleOverlay(field.id)}
                  />
                ))}
              </div>
            ) : pdfBuffer ? (
              <div className="text-center py-8 text-surface-500">
                <FileSearch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No fields detected yet</p>
                <p className="text-xs mt-1">Click "Detect Form Fields" to start</p>
              </div>
            ) : null}

            {/* Selected Field Editor */}
            {selectedField && (
              <div className="p-4 bg-surface-50 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700">
                <h4 className="text-sm font-medium mb-3">Field Properties</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-surface-500">Position X</label>
                    <Input
                      type="number"
                      value={Math.round(selectedField.bounds.x)}
                      onChange={(e) =>
                        handleUpdateField(selectedField.id, {
                          bounds: { ...selectedField.bounds, x: Number(e.target.value) },
                        })
                      }
                      className="h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-surface-500">Position Y</label>
                    <Input
                      type="number"
                      value={Math.round(selectedField.bounds.y)}
                      onChange={(e) =>
                        handleUpdateField(selectedField.id, {
                          bounds: { ...selectedField.bounds, y: Number(e.target.value) },
                        })
                      }
                      className="h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-surface-500">Width</label>
                    <Input
                      type="number"
                      value={Math.round(selectedField.bounds.width)}
                      onChange={(e) =>
                        handleUpdateField(selectedField.id, {
                          bounds: { ...selectedField.bounds, width: Number(e.target.value) },
                        })
                      }
                      className="h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-surface-500">Height</label>
                    <Input
                      type="number"
                      value={Math.round(selectedField.bounds.height)}
                      onChange={(e) =>
                        handleUpdateField(selectedField.id, {
                          bounds: { ...selectedField.bounds, height: Number(e.target.value) },
                        })
                      }
                      className="h-8"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="field-required"
                    checked={selectedField.required}
                    onChange={(e) =>
                      handleUpdateField(selectedField.id, { required: e.target.checked })
                    }
                    className="rounded border-surface-300"
                  />
                  <label htmlFor="field-required" className="text-sm">
                    Required field
                  </label>
                </div>
              </div>
            )}

            {/* Create Fillable PDF Button */}
            <Button
              onClick={handleCreateFillable}
              disabled={detectedFields.length === 0 || isProcessing}
              className="w-full"
              variant="default"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Create Fillable PDF
                </>
              )}
            </Button>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6 mt-4">
            {/* Sensitivity Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Detection Sensitivity
                </label>
                <span className="text-sm text-surface-500">{sensitivity}%</span>
              </div>
              <Slider
                value={[sensitivity]}
                onValueChange={([value]) => setSensitivity(value ?? 50)}
                min={10}
                max={100}
                step={5}
                disabled={isProcessing}
              />
              <p className="text-xs text-surface-500">
                Higher sensitivity detects more fields but may include false positives
              </p>
            </div>

            {/* Minimum Confidence Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Minimum Confidence
                </label>
                <span className="text-sm text-surface-500">{minConfidence}%</span>
              </div>
              <Slider
                value={[minConfidence]}
                onValueChange={([value]) => setMinConfidence(value ?? 30)}
                min={10}
                max={90}
                step={5}
                disabled={isProcessing}
              />
              <p className="text-xs text-surface-500">
                Fields below this confidence threshold will be excluded
              </p>
            </div>

            {/* Field Type Toggles */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Field Types to Detect
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detectText}
                    onChange={(e) => setDetectText(e.target.checked)}
                    disabled={isProcessing}
                    className="rounded border-surface-300"
                  />
                  <Type className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Text Fields</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detectCheckboxes}
                    onChange={(e) => setDetectCheckboxes(e.target.checked)}
                    disabled={isProcessing}
                    className="rounded border-surface-300"
                  />
                  <CheckSquare className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Checkboxes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detectSignatures}
                    onChange={(e) => setDetectSignatures(e.target.checked)}
                    disabled={isProcessing}
                    className="rounded border-surface-300"
                  />
                  <PenTool className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Signatures</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detectDates}
                    onChange={(e) => setDetectDates(e.target.checked)}
                    disabled={isProcessing}
                    className="rounded border-surface-300"
                  />
                  <Calendar className="h-4 w-4 text-cyan-500" />
                  <span className="text-sm">Date Fields</span>
                </label>
              </div>
            </div>

            {/* Re-detect Button */}
            <Button
              onClick={handleDetect}
              disabled={!pdfBuffer || isProcessing}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-detect with New Settings
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
