// Hooks Export
// Re-export all hooks for convenient importing

export * from './use-toast';

// PDF hooks
export {
  usePdfDocument,
  type PdfMetadata,
  type PdfLoadingState,
  type UsePdfDocumentReturn,
  type UsePdfDocumentOptions,
} from './usePdfDocument';

export {
  usePdfPage,
  type PageRenderState,
  type PageDimensions,
  type UsePdfPageReturn,
  type UsePdfPageOptions,
} from './usePdfPage';

// Storage hooks
export {
  useIndexedDB,
  type OperationState,
  type MutationResult,
  type UseIndexedDBReturn,
} from './useIndexedDB';

export {
  useStorageQuota,
  useStoragePercentage,
  useHasStorageSpace,
  formatBytes,
  type StorageQuotaState,
  type UseStorageQuotaOptions,
  type UseStorageQuotaReturn,
} from './useStorageQuota';

// OCR hooks
export {
  useOCR,
  type OCRState,
  type OCRProgress,
  type UseOCROptions,
  type UseOCRReturn,
} from './useOCR';

// RAG hooks
export {
  useRAG,
  useIndexingProgress,
  type IndexingState,
  type QueryState,
  type UseRAGOptions,
  type UseRAGReturn,
} from './useRAG';

// PWA hooks
export {
  usePWA,
  useOnlineStatus,
  useStandaloneMode,
  type PWAState,
  type PWAActions,
  type UsePWAReturn,
} from './usePWA';

// Text search hooks
export {
  useTextSearch,
  type SearchResult,
  type SearchOptions,
  type SearchState,
  type UseTextSearchReturn,
  type UseTextSearchOptions,
} from './useTextSearch';

// Batch processing hooks
export {
  useBatchProcessor,
  useBatchProcessorState,
  type BatchProcessorState,
  type UseBatchProcessorOptions,
  type UseBatchProcessorReturn,
} from './useBatchProcessor';

// Image extraction hooks
export {
  useImageExtraction,
  type ExtractionState,
  type ExtractionProgress,
  type UseImageExtractionOptions,
  type UseImageExtractionReturn,
} from './useImageExtraction';

// Table extraction hooks
export {
  useTableExtraction,
  type TableExtractionState,
  type TableExtractionProgress,
  type CellEdit,
  type UseTableExtractionOptions,
  type UseTableExtractionReturn,
} from './useTableExtraction';

// PDF comparison hooks
export {
  usePdfComparison,
  type ComparisonState,
  type ComparisonMode,
  type ComparisonProgress,
  type UsePdfComparisonOptions,
  type UsePdfComparisonReturn,
  type ComparisonResult,
  type ComparisonSummary,
  type PageComparison,
  type Difference,
  type DifferenceType,
  type LineDiff,
  type TextComparisonResult,
  type VisualPageDiff,
} from './usePdfComparison';

// Operation history hooks
export {
  useOperationHistory,
  useHistoryState,
  type RecordOperationOptions,
  type UndoResult,
  type RedoResult,
  type UseOperationHistoryOptions,
  type UseOperationHistoryReturn,
} from './useOperationHistory';
