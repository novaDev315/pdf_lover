/**
 * ClassificationPanel - Document Classification component
 * Allows users to classify PDF documents by type with confidence scoring
 */

import * as React from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  FileText,
  Sparkles,
  Download,
  Loader2,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Edit3,
  Save,
  RotateCcw,
  Brain,
  Tag,
  BarChart3,
  FileStack,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileDropzone } from '@/components/file-manager/FileDropzone';
import { useToast } from '@/hooks/use-toast';
import { cn, formatFileSize, downloadBlob, generateId } from '@/lib/utils';
import { extractText } from '@pdflover/pdf-core';
import {
  classifyDocumentEnhanced,
  generateClassificationSummary,
  initializeMLClassifier,
  isMLClassificationAvailable,
  getDocumentTypes,
  getDocumentTypeLabel,
  type EnhancedClassification,
  type DocumentType,
  type ClassificationSummary,
} from '@/lib/ai/classifier';

/**
 * Document item for classification
 */
interface ClassificationItem {
  id: string;
  file: File;
  text?: string;
  pageCount?: number;
  classification?: EnhancedClassification;
  isProcessing: boolean;
  error?: string;
  manualType?: DocumentType;
}

/**
 * Classification mode
 */
type ClassificationMode = 'single' | 'batch';

/**
 * Props for ClassificationPanel
 */
export interface ClassificationPanelProps {
  /** Additional CSS classes */
  className?: string;
  /** Callback when classification is complete */
  onClassificationComplete?: (results: EnhancedClassification[]) => void;
}

/**
 * Get color classes for document type
 */
function getTypeColor(type: DocumentType): string {
  const colors: Record<DocumentType, string> = {
    invoice: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
    contract: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950 dark:border-purple-800',
    report: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800',
    resume: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800',
    academic: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950 dark:border-indigo-800',
    form: 'text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-950 dark:border-cyan-800',
    letter: 'text-pink-600 bg-pink-50 border-pink-200 dark:text-pink-400 dark:bg-pink-950 dark:border-pink-800',
    legal: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800',
    financial: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
    medical: 'text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950 dark:border-rose-800',
    other: 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700',
  };
  return colors[type] || colors.other;
}

/**
 * Get confidence color
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 70) return 'text-green-600 dark:text-green-400';
  if (confidence >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Confidence meter component
 */
function ConfidenceMeter({ confidence, size = 'default' }: { confidence: number; size?: 'small' | 'default' }) {
  const isSmall = size === 'small';

  return (
    <div className={cn('flex items-center gap-2', isSmall && 'gap-1')}>
      <div className={cn(
        'flex-1 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden',
        isSmall ? 'h-1.5' : 'h-2'
      )}>
        <div
          className={cn(
            'h-full rounded-full transition-all',
            confidence >= 70 ? 'bg-green-500' :
            confidence >= 40 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className={cn(
        'font-medium',
        isSmall ? 'text-xs' : 'text-sm',
        getConfidenceColor(confidence)
      )}>
        {confidence}%
      </span>
    </div>
  );
}

/**
 * Single classification result display
 */
function ClassificationResult({
  item,
  expanded,
  onToggleExpand,
  onManualTypeChange,
  onSaveManualType,
  onReprocess,
}: {
  item: ClassificationItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onManualTypeChange: (type: DocumentType) => void;
  onSaveManualType: () => void;
  onReprocess: () => void;
}) {
  const [isEditing, setIsEditing] = React.useState(false);

  const classification = item.classification;
  if (!classification && !item.isProcessing && !item.error) {
    return null;
  }

  const displayType = item.manualType || classification?.type || 'other';

  return (
    <div className="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 bg-white dark:bg-surface-800 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-750"
        onClick={onToggleExpand}
      >
        <FileText className="h-5 w-5 text-surface-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
            {item.file.name}
          </p>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            {formatFileSize(item.file.size)}
            {item.pageCount && ` - ${item.pageCount} page${item.pageCount !== 1 ? 's' : ''}`}
          </p>
        </div>

        {item.isProcessing ? (
          <Loader2 className="h-5 w-5 text-primary-500 animate-spin" />
        ) : item.error ? (
          <AlertTriangle className="h-5 w-5 text-red-500" />
        ) : classification ? (
          <>
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border',
              getTypeColor(displayType)
            )}>
              {getDocumentTypeLabel(displayType)}
            </div>
            <div className="w-24">
              <ConfidenceMeter confidence={classification.confidence} size="small" />
            </div>
          </>
        ) : null}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          className="p-1 text-surface-400 hover:text-surface-600"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-surface-200 dark:border-surface-700 p-4 bg-surface-50 dark:bg-surface-900 space-y-4">
          {item.error ? (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{item.error}</p>
            </div>
          ) : classification ? (
            <>
              {/* Type with Manual Override */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-surface-500" />
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Document Type
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Select
                        value={item.manualType || classification.type}
                        onValueChange={(v) => onManualTypeChange(v as DocumentType)}
                      >
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getDocumentTypes().map((type) => (
                            <SelectItem key={type} value={type}>
                              {getDocumentTypeLabel(type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onSaveManualType();
                          setIsEditing(false);
                        }}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium border',
                        getTypeColor(displayType)
                      )}>
                        {getDocumentTypeLabel(displayType)}
                        {item.manualType && ' (manual)'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditing(true)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Confidence */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Confidence
                  </span>
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded',
                    classification.confidenceLevel === 'high'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : classification.confidenceLevel === 'medium'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}>
                    {classification.confidenceLevel}
                  </span>
                </div>
                <ConfidenceMeter confidence={classification.confidence} />
              </div>

              {/* Alternatives */}
              {classification.alternatives.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Alternative Classifications
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {classification.alternatives.map((alt) => (
                      <div
                        key={alt.type}
                        className="flex items-center gap-1 text-xs text-surface-600 dark:text-surface-400"
                      >
                        <span className={cn(
                          'px-2 py-0.5 rounded border',
                          getTypeColor(alt.type)
                        )}>
                          {getDocumentTypeLabel(alt.type)}
                        </span>
                        <span className={getConfidenceColor(alt.confidence)}>
                          {alt.confidence}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {classification.features.keywords.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Detected Keywords ({classification.features.keywords.length})
                  </h5>
                  <div className="flex flex-wrap gap-1">
                    {classification.features.keywords.slice(0, 15).map((kw, idx) => (
                      <span
                        key={`${kw.keyword}-${idx}`}
                        className="px-2 py-0.5 text-xs bg-surface-100 dark:bg-surface-700 rounded"
                      >
                        {kw.keyword}
                        <span className="text-surface-500 ml-1">x{kw.count}</span>
                      </span>
                    ))}
                    {classification.features.keywords.length > 15 && (
                      <span className="px-2 py-0.5 text-xs text-surface-500">
                        +{classification.features.keywords.length - 15} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Entities */}
              {(classification.features.entities.dates.length > 0 ||
                classification.features.entities.amounts.length > 0 ||
                classification.features.entities.emails.length > 0) && (
                <div>
                  <h5 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Detected Entities
                  </h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {classification.features.entities.dates.length > 0 && (
                      <div>
                        <span className="text-surface-500">Dates:</span>{' '}
                        {classification.features.entities.dates.slice(0, 3).join(', ')}
                        {classification.features.entities.dates.length > 3 && '...'}
                      </div>
                    )}
                    {classification.features.entities.amounts.length > 0 && (
                      <div>
                        <span className="text-surface-500">Amounts:</span>{' '}
                        {classification.features.entities.amounts.slice(0, 3).join(', ')}
                        {classification.features.entities.amounts.length > 3 && '...'}
                      </div>
                    )}
                    {classification.features.entities.emails.length > 0 && (
                      <div>
                        <span className="text-surface-500">Emails:</span>{' '}
                        {classification.features.entities.emails.slice(0, 2).join(', ')}
                      </div>
                    )}
                    {classification.features.entities.phones.length > 0 && (
                      <div>
                        <span className="text-surface-500">Phones:</span>{' '}
                        {classification.features.entities.phones.slice(0, 2).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ML Badge */}
              {classification.usedML && (
                <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
                  <Brain className="h-3 w-3" />
                  <span>ML-enhanced classification</span>
                </div>
              )}

              {/* Reprocess Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={onReprocess}
                className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Re-classify
              </Button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Classification Panel component
 */
export function ClassificationPanel({ className, onClassificationComplete }: ClassificationPanelProps) {
  const [mode, setMode] = React.useState<ClassificationMode>('single');
  const [items, setItems] = React.useState<ClassificationItem[]>([]);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState({ percentage: 0, stage: '' });
  const [useML, setUseML] = React.useState(false);
  const [isLoadingML, setIsLoadingML] = React.useState(false);
  const [summary, setSummary] = React.useState<ClassificationSummary | null>(null);
  const { toast } = useToast();

  const mlAvailable = isMLClassificationAvailable();

  /**
   * Handle file upload
   */
  const handleFilesAccepted = React.useCallback((files: File[]) => {
    const newItems: ClassificationItem[] = files.map((file) => ({
      id: generateId(),
      file,
      isProcessing: false,
    }));

    if (mode === 'single') {
      setItems(newItems.slice(0, 1));
    } else {
      setItems((prev) => [...prev, ...newItems]);
    }

    setSummary(null);
  }, [mode]);

  /**
   * Clear all items
   */
  const handleClearAll = React.useCallback(() => {
    setItems([]);
    setExpandedId(null);
    setSummary(null);
  }, []);

  /**
   * Extract text from a PDF file
   */
  const extractPdfText = React.useCallback(async (file: File): Promise<{ text: string; pageCount: number }> => {
    const buffer = await file.arrayBuffer();
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pageCount = doc.getPageCount();

    // Extract text using pdf-core
    const text = await extractText(buffer);

    return { text: text || '', pageCount };
  }, []);

  /**
   * Classify a single item
   */
  const classifyItem = React.useCallback(async (item: ClassificationItem): Promise<ClassificationItem> => {
    try {
      // Extract text if not already done
      let text = item.text;
      let pageCount = item.pageCount;

      if (!text) {
        const extracted = await extractPdfText(item.file);
        text = extracted.text;
        pageCount = extracted.pageCount;
      }

      // Classify
      const classification = await classifyDocumentEnhanced(
        text,
        pageCount,
        undefined,
        {
          useML,
          fullAnalysis: true,
        }
      );

      return {
        ...item,
        text,
        pageCount,
        classification,
        isProcessing: false,
        error: undefined,
      };
    } catch (error) {
      return {
        ...item,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Classification failed',
      };
    }
  }, [extractPdfText, useML]);

  /**
   * Run classification on all items
   */
  const handleClassify = React.useCallback(async () => {
    if (items.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please upload PDF files to classify',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setProgress({ percentage: 0, stage: 'Starting classification...' });

    try {
      // Mark all items as processing
      setItems((prev) => prev.map((item) => ({ ...item, isProcessing: true })));

      const results: ClassificationItem[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        setProgress({
          percentage: Math.round((i / items.length) * 100),
          stage: `Classifying ${item.file.name}...`,
        });

        const classified = await classifyItem(item);
        results.push(classified);

        // Update item in state
        setItems((prev) => prev.map((p) => (p.id === item.id ? classified : p)));
      }

      setProgress({ percentage: 100, stage: 'Complete' });

      // Generate summary for batch mode
      if (mode === 'batch' && results.length > 1) {
        const classifications = results
          .filter((r) => r.classification)
          .map((r) => r.classification!);
        setSummary(generateClassificationSummary(classifications));
      }

      // Expand first result if single mode
      if (mode === 'single' && results[0]) {
        setExpandedId(results[0].id);
      }

      // Callback
      const successfulResults = results
        .filter((r) => r.classification)
        .map((r) => r.classification!);
      if (successfulResults.length > 0) {
        onClassificationComplete?.(successfulResults);
      }

      toast({
        title: 'Classification Complete',
        description: `Classified ${successfulResults.length} document(s)`,
      });
    } catch (error) {
      toast({
        title: 'Classification Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [items, classifyItem, mode, onClassificationComplete, toast]);

  /**
   * Reprocess a single item
   */
  const handleReprocess = React.useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    setItems((prev) => prev.map((p) =>
      p.id === id ? { ...p, isProcessing: true, classification: undefined } : p
    ));

    const classified = await classifyItem({ ...item, text: undefined });
    setItems((prev) => prev.map((p) => (p.id === id ? classified : p)));
  }, [items, classifyItem]);

  /**
   * Load ML model
   */
  const handleLoadML = React.useCallback(async () => {
    setIsLoadingML(true);
    const result = await initializeMLClassifier(() => {
      // Progress updates handled by model loader
    });

    setIsLoadingML(false);

    if (result.success) {
      setUseML(true);
      toast({
        title: 'ML Model Loaded',
        description: 'ML-enhanced classification is now available',
      });
    } else {
      toast({
        title: 'Failed to Load ML Model',
        description: result.error || 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [toast]);

  /**
   * Export classifications as JSON
   */
  const handleExportJSON = React.useCallback(() => {
    const data = items
      .filter((item) => item.classification)
      .map((item) => ({
        filename: item.file.name,
        type: item.manualType || item.classification?.type,
        confidence: item.classification?.confidence,
        confidenceLevel: item.classification?.confidenceLevel,
        alternatives: item.classification?.alternatives,
        features: {
          keywordCount: item.classification?.features.keywords.length,
          topKeywords: item.classification?.features.keywords.slice(0, 5).map((k) => k.keyword),
        },
      }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'classifications.json');
  }, [items]);

  /**
   * Export classifications as CSV
   */
  const handleExportCSV = React.useCallback(() => {
    const headers = ['Filename', 'Type', 'Confidence', 'Confidence Level', 'Manual Override'];
    const rows = items
      .filter((item) => item.classification)
      .map((item) => [
        item.file.name,
        item.manualType || item.classification?.type || '',
        item.classification?.confidence?.toString() || '',
        item.classification?.confidenceLevel || '',
        item.manualType ? 'Yes' : 'No',
      ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, 'classifications.csv');
  }, [items]);

  const hasResults = items.some((item) => item.classification);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Document Classification
        </CardTitle>
        <CardDescription>
          Automatically classify PDF documents by type (invoice, contract, report, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Selection */}
        <Tabs value={mode} onValueChange={(v) => { setMode(v as ClassificationMode); setItems([]); setSummary(null); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              Single Document
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-1.5">
              <FileStack className="h-4 w-4" />
              Batch Mode
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-4">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Upload a single PDF to classify and view detailed analysis.
            </p>
          </TabsContent>

          <TabsContent value="batch" className="mt-4">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              Upload multiple PDFs for batch classification with summary statistics.
            </p>
          </TabsContent>
        </Tabs>

        {/* ML Toggle */}
        <div className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-sm font-medium text-surface-900 dark:text-white">
                ML-Enhanced Classification
              </p>
              <p className="text-xs text-surface-500">
                {mlAvailable
                  ? 'Loaded and ready'
                  : 'Load model for improved accuracy'}
              </p>
            </div>
          </div>
          {mlAvailable ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUseML(!useML)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  useML ? 'bg-purple-500' : 'bg-surface-300 dark:bg-surface-600'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    useML ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleLoadML}
              disabled={isLoadingML}
            >
              {isLoadingML ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load Model'
              )}
            </Button>
          )}
        </div>

        {/* File Upload */}
        {items.length === 0 || mode === 'batch' ? (
          <FileDropzone
            onFilesAccepted={handleFilesAccepted}
            multiple={mode === 'batch'}
            maxFiles={mode === 'batch' ? 50 : 1}
          />
        ) : null}

        {/* File List */}
        {items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300">
                {items.length} file{items.length !== 1 ? 's' : ''} selected
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="text-red-500 hover:text-red-600"
              >
                <X className="h-4 w-4 mr-1" />
                Clear all
              </Button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {items.map((item) => (
                <ClassificationResult
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onManualTypeChange={(type) => {
                    setItems((prev) =>
                      prev.map((p) => (p.id === item.id ? { ...p, manualType: type } : p))
                    );
                  }}
                  onSaveManualType={() => {
                    toast({ title: 'Type Updated', description: 'Manual classification saved' });
                  }}
                  onReprocess={() => handleReprocess(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-600 dark:text-surface-400">
                {progress.stage}
              </span>
              <span className="font-medium">{Math.round(progress.percentage)}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </div>
        )}

        {/* Summary Statistics */}
        {summary && (
          <div className="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary-500" />
              <h4 className="text-sm font-medium text-surface-900 dark:text-white">
                Classification Summary
              </h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-surface-500">Total</p>
                <p className="font-semibold text-surface-900 dark:text-white">
                  {summary.totalDocuments}
                </p>
              </div>
              <div>
                <p className="text-surface-500">Avg Confidence</p>
                <p className={cn('font-semibold', getConfidenceColor(summary.averageConfidence))}>
                  {summary.averageConfidence}%
                </p>
              </div>
              <div>
                <p className="text-surface-500">High Confidence</p>
                <p className="font-semibold text-green-600 dark:text-green-400">
                  {summary.highConfidenceCount}
                </p>
              </div>
              <div>
                <p className="text-surface-500">Low Confidence</p>
                <p className="font-semibold text-red-600 dark:text-red-400">
                  {summary.lowConfidenceCount}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-surface-200 dark:border-surface-700">
              <p className="text-xs text-surface-500 mb-2">By Type:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.byType)
                  .filter(([, count]) => count > 0)
                  .map(([type, count]) => (
                    <span
                      key={type}
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded-full border',
                        getTypeColor(type as DocumentType)
                      )}
                    >
                      {getDocumentTypeLabel(type as DocumentType)}: {count}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {items.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            {!hasResults ? (
              <Button
                onClick={handleClassify}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Classifying...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Classify {mode === 'batch' ? 'All' : 'Document'}
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleExportJSON}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClassify}
                  disabled={isProcessing}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Re-classify All
                </Button>
              </>
            )}
          </div>
        )}

        {/* Info Note */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Privacy:</strong> Classification happens entirely in your browser.
            No documents are sent to any server. Enable ML mode for improved accuracy
            (requires downloading a small model).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
