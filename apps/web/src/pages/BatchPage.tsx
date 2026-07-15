/**
 * BatchPage - Page for batch PDF operations
 * Provides interface for adding multiple files and selecting batch operations
 */

import * as React from 'react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Layers,
  FileText,
  Minimize2,
  FileOutput,
  Droplets,
  Scissors,
  ScanText,
  Lock,
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  X,
  Play,
  Settings2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { FileDropzone } from '@/components/file-manager/FileDropzone';
import { BatchPanel } from '@/components/batch/BatchPanel';
import { useToast } from '@/hooks/use-toast';
import { useBatchProcessor } from '@/hooks/useBatchProcessor';
import {
  cn,
  formatFileSize,
  generateId,
} from '@/lib/utils';
import {
  useBatchStore,
  selectQueueStats,
  type BatchOperationType,
  type BatchOperationOptions,
  type CompressOptions,
  type WatermarkOptions,
  type SplitOptions,
  type SecurityOptions,
  type ConvertOptions,
  type OCROptions,
  type BatchFileInfo,
} from '@/store/batch-store';

/**
 * Operation type configuration
 */
interface OperationConfig {
  type: BatchOperationType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const OPERATION_CONFIGS: OperationConfig[] = [
  {
    type: 'merge',
    label: 'Merge All',
    description: 'Combine all PDFs into one document',
    icon: <FileText className="h-5 w-5" />,
    color: 'text-blue-500 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
  },
  {
    type: 'compress',
    label: 'Compress All',
    description: 'Reduce file size for all PDFs',
    icon: <Minimize2 className="h-5 w-5" />,
    color: 'text-orange-500 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800',
  },
  {
    type: 'convert',
    label: 'Convert All',
    description: 'Convert all PDFs to another format',
    icon: <FileOutput className="h-5 w-5" />,
    color: 'text-purple-500 bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800',
  },
  {
    type: 'watermark',
    label: 'Add Watermark',
    description: 'Add watermark to all PDFs',
    icon: <Droplets className="h-5 w-5" />,
    color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800',
  },
  {
    type: 'split',
    label: 'Split All',
    description: 'Split each PDF into pages',
    icon: <Scissors className="h-5 w-5" />,
    color: 'text-green-500 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
  },
  {
    type: 'ocr',
    label: 'OCR All',
    description: 'Extract text from scanned PDFs',
    icon: <ScanText className="h-5 w-5" />,
    color: 'text-amber-500 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800',
  },
  {
    type: 'security',
    label: 'Add Security',
    description: 'Password protect all PDFs',
    icon: <Lock className="h-5 w-5" />,
    color: 'text-red-500 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
  },
];

/**
 * File item for the upload list
 */
interface UploadFileItem {
  id: string;
  file: File;
}

/**
 * Sortable file item component
 */
function SortableFileItem({
  item,
  onRemove,
}: {
  item: UploadFileItem;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

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
        className="cursor-grab active:cursor-grabbing touch-none p-1 text-surface-400 hover:text-surface-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <FileText className="h-5 w-5 text-surface-400 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
          {item.file.name}
        </p>
        <p className="text-xs text-surface-500 dark:text-surface-400">
          {formatFileSize(item.file.size)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="p-1.5 text-surface-400 hover:text-red-500 rounded-md hover:bg-surface-100 dark:hover:bg-surface-700"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Options panel for different operation types
 */
function OperationOptions({
  type,
  options,
  onChange,
}: {
  type: BatchOperationType;
  options: BatchOperationOptions;
  onChange: (options: BatchOperationOptions) => void;
}) {
  switch (type) {
    case 'compress': {
      const compressOptions = options as CompressOptions;
      const levelIndex = ['low', 'medium', 'high', 'maximum'].indexOf(
        compressOptions.level
      );
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Compression Level</label>
              <span className="text-sm text-primary-600 dark:text-primary-400 capitalize">
                {compressOptions.level}
              </span>
            </div>
            <Slider
              value={[levelIndex]}
              onValueChange={([value = 1]) => {
                const levels: CompressOptions['level'][] = [
                  'low',
                  'medium',
                  'high',
                  'maximum',
                ];
                onChange({ ...compressOptions, level: levels[value] ?? 'medium', serverConsent: false });
              }}
              min={0}
              max={3}
              step={1}
            />
            <div className="flex justify-between text-xs text-surface-500">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
              <span>Max</span>
            </div>
            {compressOptions.level === 'maximum' && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
                <input
                  type="checkbox"
                  checked={compressOptions.serverConsent === true}
                  onChange={(event) => onChange({ ...compressOptions, serverConsent: event.target.checked })}
                  className="mt-0.5 rounded"
                />
                <span>Upload these PDFs to the temporary backend for raster recompression. Inputs are deleted after processing; outputs are deleted after download or TTL.</span>
              </label>
            )}
          </div>
        </div>
      );
    }

    case 'watermark': {
      const watermarkOptions = options as WatermarkOptions;
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Watermark Text</label>
            <Input
              value={watermarkOptions.text}
              onChange={(e) =>
                onChange({ ...watermarkOptions, text: e.target.value })
              }
              placeholder="Enter watermark text"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Opacity</label>
              <span className="text-sm text-surface-600">
                {Math.round(watermarkOptions.opacity * 100)}%
              </span>
            </div>
            <Slider
              value={[watermarkOptions.opacity * 100]}
              onValueChange={([value = 30]) =>
                onChange({ ...watermarkOptions, opacity: value / 100 })
              }
              min={10}
              max={100}
              step={5}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Font Size</label>
              <span className="text-sm text-surface-600">
                {watermarkOptions.fontSize}px
              </span>
            </div>
            <Slider
              value={[watermarkOptions.fontSize]}
              onValueChange={([value = 48]) =>
                onChange({ ...watermarkOptions, fontSize: value })
              }
              min={12}
              max={72}
              step={2}
            />
          </div>
        </div>
      );
    }

    case 'split': {
      const splitOptions = options as SplitOptions;
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Split Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {(['all', 'even', 'odd', 'range'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ ...splitOptions, mode })}
                  className={cn(
                    'px-3 py-2 text-sm rounded-lg border transition-colors capitalize',
                    splitOptions.mode === mode
                      ? 'bg-primary-50 dark:bg-primary-950 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                  )}
                >
                  {mode === 'all' ? 'All Pages' : mode}
                </button>
              ))}
            </div>
          </div>
          {splitOptions.mode === 'range' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Page Ranges</label>
              <Input
                value={splitOptions.ranges ?? ''}
                onChange={(e) =>
                  onChange({ ...splitOptions, ranges: e.target.value })
                }
                placeholder="e.g., 1-3, 5, 7-10"
              />
              <p className="text-xs text-surface-500">
                Enter page numbers or ranges separated by commas
              </p>
            </div>
          )}
        </div>
      );
    }

    case 'security': {
      const securityOptions = options as SecurityOptions;
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">User Password (optional)</label>
            <Input
              type="password"
              value={securityOptions.userPassword ?? ''}
              onChange={(e) =>
                onChange({ ...securityOptions, userPassword: e.target.value })
              }
              placeholder="Password required to open"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Owner Password (required)</label>
            <Input
              type="password"
              value={securityOptions.ownerPassword ?? ''}
              onChange={(e) =>
                onChange({ ...securityOptions, ownerPassword: e.target.value })
              }
              placeholder="Password required to change protection"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Permissions</label>
            <div className="space-y-2">
              {(['print', 'copy', 'modify'] as const).map((perm) => (
                <label key={perm} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={securityOptions.permissions?.[perm] ?? true}
                    onChange={(e) =>
                      onChange({
                        ...securityOptions,
                        permissions: {
                          ...securityOptions.permissions,
                          print: securityOptions.permissions?.print ?? true,
                          copy: securityOptions.permissions?.copy ?? true,
                          modify: securityOptions.permissions?.modify ?? true,
                          [perm]: e.target.checked,
                        },
                      })
                    }
                    className="rounded border-surface-300"
                  />
                  <span className="text-sm capitalize">Allow {perm}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case 'convert': {
      const convertOptions = options as ConvertOptions;
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Output Format</label>
            <div className="grid grid-cols-3 gap-2">
              {(['png', 'jpg', 'webp', 'svg', 'txt', 'html', 'docx', 'xlsx', 'pptx'] as const).map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => onChange({ ...convertOptions, format, serverConsent: false })}
                  className={cn(
                    'px-3 py-2 text-sm rounded-lg border transition-colors uppercase',
                    convertOptions.format === format
                      ? 'bg-primary-50 dark:bg-primary-950 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                  )}
                >
                  {format}
                </button>
              ))}
            </div>
            {['docx', 'xlsx', 'pptx'].includes(convertOptions.format) && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
                <input
                  type="checkbox"
                  checked={convertOptions.serverConsent === true}
                  onChange={(event) => onChange({ ...convertOptions, serverConsent: event.target.checked })}
                  className="mt-0.5 rounded"
                />
                <span>Upload these PDFs to the temporary backend for best-effort Office conversion. Inputs are deleted after processing; outputs are deleted after download or TTL.</span>
              </label>
            )}
          </div>
        </div>
      );
    }

    case 'ocr': {
      const ocrOptions = options as OCROptions;
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="ocr-language">OCR language</label>
            <select
              id="ocr-language"
              value={ocrOptions.language}
              onChange={(event) => onChange({ ...ocrOptions, language: event.target.value })}
              className="w-full rounded-lg border border-surface-300 bg-card px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            >
              {[
                ['eng', 'English'], ['spa', 'Spanish'], ['fra', 'French'], ['deu', 'German'],
                ['ita', 'Italian'], ['por', 'Portuguese'], ['nld', 'Dutch'], ['pol', 'Polish'],
                ['rus', 'Russian'], ['jpn', 'Japanese'], ['chi_sim', 'Chinese (Simplified)'],
                ['chi_tra', 'Chinese (Traditional)'], ['kor', 'Korean'], ['ara', 'Arabic'], ['hin', 'Hindi'],
              ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ocrOptions.enhanceScans}
              onChange={(event) => onChange({ ...ocrOptions, enhanceScans: event.target.checked })}
              className="rounded"
            />
            Enhance scan contrast before recognition
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['local', 'server'] as const).map((engine) => (
              <button
                key={engine}
                type="button"
                onClick={() => onChange({ ...ocrOptions, engine, serverConsent: false })}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm capitalize',
                  ocrOptions.engine === engine
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                    : 'border-surface-200 dark:border-surface-700',
                )}
              >
                {engine} OCR
              </button>
            ))}
          </div>
          {ocrOptions.engine === 'server' && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
              <input
                type="checkbox"
                checked={ocrOptions.serverConsent === true}
                onChange={(event) => onChange({ ...ocrOptions, serverConsent: event.target.checked })}
                className="mt-0.5 rounded"
              />
              <span>Upload these PDFs to the temporary backend for Tesseract OCR. Inputs are deleted after processing; outputs are deleted after download or TTL.</span>
            </label>
          )}
        </div>
      );
    }

    default:
      return (
        <p className="text-sm text-surface-500 dark:text-surface-400">
          No additional options for this operation type.
        </p>
      );
  }
}

/**
 * Get default options for an operation type
 */
function getDefaultOptions(type: BatchOperationType): BatchOperationOptions {
  switch (type) {
    case 'compress':
      return { level: 'medium' } as CompressOptions;
    case 'watermark':
      return {
        text: 'CONFIDENTIAL',
        position: 'center',
        opacity: 0.3,
        fontSize: 48,
        color: '#888888',
        rotation: -45,
      } as WatermarkOptions;
    case 'split':
      return { mode: 'all' } as SplitOptions;
    case 'security':
      return {
        permissions: { print: true, copy: true, modify: false },
      } as SecurityOptions;
    case 'convert':
      return { format: 'png', quality: 90 } as ConvertOptions;
    case 'ocr':
      return { language: 'eng', enhanceScans: false, engine: 'local' } as OCROptions;
    default:
      return {};
  }
}

/**
 * Batch operations page component
 */
export function BatchPage() {
  const [files, setFiles] = React.useState<UploadFileItem[]>([]);
  const [selectedType, setSelectedType] = React.useState<BatchOperationType>('merge');
  const [options, setOptions] = React.useState<BatchOperationOptions>(
    getDefaultOptions('merge')
  );
  const [showPanel, setShowPanel] = React.useState(false);

  const { toast } = useToast();
  const stats = useBatchStore(useShallow(selectQueueStats));
  const { addToQueue, startQueue } = useBatchStore();

  // Initialize batch processor
  useBatchProcessor({
    autoProcess: true,
    showToasts: true,
    storeResults: true,
  });

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
  );

  /**
   * Handle files dropped or selected
   */
  const handleFilesAccepted = React.useCallback((acceptedFiles: File[]) => {
    const newItems: UploadFileItem[] = acceptedFiles.map((file) => ({
      id: generateId(),
      file,
    }));
    setFiles((prev) => [...prev, ...newItems]);

    toast({
      title: 'Files added',
      description: `Added ${acceptedFiles.length} file(s)`,
    });
  }, [toast]);

  /**
   * Remove a file from the list
   */
  const handleRemoveFile = React.useCallback((id: string) => {
    setFiles((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * Clear all files
   */
  const handleClearAll = React.useCallback(() => {
    setFiles([]);
  }, []);

  /**
   * Handle drag end for reordering
   */
  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  /**
   * Handle operation type change
   */
  const handleTypeChange = React.useCallback((type: BatchOperationType) => {
    setSelectedType(type);
    setOptions(getDefaultOptions(type));
  }, []);

  /**
   * Add operation to queue
   */
  const handleAddToQueue = React.useCallback(() => {
    if (files.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please add at least one PDF file',
        variant: 'destructive',
      });
      return;
    }
    if (selectedType === 'security' && !(options as SecurityOptions).ownerPassword) {
      toast({
        title: 'Owner password required',
        description: 'Set a distinct owner password before adding encryption to the queue',
        variant: 'destructive',
      });
      return;
    }
    const requiresServerConsent =
      (selectedType === 'compress' && (options as CompressOptions).level === 'maximum') ||
      (selectedType === 'convert' && ['docx', 'xlsx', 'pptx'].includes((options as ConvertOptions).format)) ||
      (selectedType === 'ocr' && (options as OCROptions).engine === 'server');
    if (requiresServerConsent && !('serverConsent' in options && options.serverConsent === true)) {
      toast({
        title: 'Upload consent required',
        description: 'Confirm temporary backend processing before adding this operation to the queue',
        variant: 'destructive',
      });
      return;
    }

    const batchFiles: BatchFileInfo[] = files.map((item) => ({
      id: item.id,
      name: item.file.name,
      size: item.file.size,
      file: item.file,
    }));

    addToQueue({
      type: selectedType,
      files: batchFiles,
      options,
    });

    toast({
      title: 'Added to queue',
      description: `${selectedType} operation added with ${files.length} file(s)`,
    });

    // Clear files after adding to queue
    setFiles([]);
    setShowPanel(true);
  }, [files, selectedType, options, addToQueue, toast]);

  /**
   * Start processing immediately
   */
  const handleProcessNow = React.useCallback(() => {
    handleAddToQueue();
    startQueue();
  }, [handleAddToQueue, startQueue]);

  const totalSize = React.useMemo(
    () => files.reduce((sum, item) => sum + item.file.size, 0),
    [files]
  );

  const selectedConfig = OPERATION_CONFIGS.find((c) => c.type === selectedType);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex">
      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Header */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link
              to="/"
              className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-surface-600 dark:text-surface-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <Layers className="h-7 w-7 text-primary-500" />
                Batch Operations
              </h1>
              <p className="text-surface-600 dark:text-surface-400 mt-1">
                Process multiple PDFs at once with batch operations
              </p>
            </div>
          </div>

          {/* Queue Stats Bar */}
          {stats.total > 0 && (
            <div className="flex items-center gap-4 p-3 bg-card dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 mb-6">
              <Layers className="h-5 w-5 text-primary-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-surface-900 dark:text-white">
                  {stats.total} operation{stats.total !== 1 ? 's' : ''} in queue
                </p>
                <p className="text-xs text-surface-500">
                  {stats.pending} pending, {stats.processing} processing, {stats.completed} completed
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPanel(!showPanel)}
              >
                {showPanel ? 'Hide Queue' : 'Show Queue'}
              </Button>
            </div>
          )}
        </div>

        {/* Main Grid */}
        <div className="max-w-4xl mx-auto grid gap-6 lg:grid-cols-2">
          {/* File Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary-500" />
                Select Files
              </CardTitle>
              <CardDescription>
                Add PDF files to process in batch
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileDropzone
                onFilesAccepted={handleFilesAccepted}
                multiple
                maxFiles={100}
              />

              {files.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300">
                      {files.length} file{files.length !== 1 ? 's' : ''} selected
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="text-red-500 hover:text-red-600"
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
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
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

                  <div className="text-sm text-surface-500 pt-2 border-t border-surface-200 dark:border-surface-700">
                    Total size: {formatFileSize(totalSize)}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Operation Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary-500" />
                Select Operation
              </CardTitle>
              <CardDescription>
                Choose what to do with your files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Operation Type Grid */}
              <div className="grid grid-cols-2 gap-2">
                {OPERATION_CONFIGS.map((config) => (
                  <button
                    key={config.type}
                    type="button"
                    onClick={() => handleTypeChange(config.type)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border text-left transition-all',
                      selectedType === config.type
                        ? config.color
                        : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                    )}
                  >
                    {config.icon}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{config.label}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Selected Operation Info */}
              {selectedConfig && (
                <div className={cn('p-4 rounded-lg border', selectedConfig.color)}>
                  <div className="flex items-center gap-2 mb-2">
                    {selectedConfig.icon}
                    <h4 className="font-medium">{selectedConfig.label}</h4>
                  </div>
                  <p className="text-sm opacity-80">{selectedConfig.description}</p>
                </div>
              )}

              {/* Operation Options */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Options
                </h4>
                <div className="p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
                  <OperationOptions
                    type={selectedType}
                    options={options}
                    onChange={setOptions}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleProcessNow}
                  disabled={files.length === 0}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Process Now
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAddToQueue}
                  disabled={files.length === 0}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Queue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Batch Panel Sidebar */}
      {showPanel && (
        <BatchPanel
          collapsible
          onCollapseChange={(collapsed) => {
            if (collapsed) setShowPanel(false);
          }}
        />
      )}
    </div>
  );
}
