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
