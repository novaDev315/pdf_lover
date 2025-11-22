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
