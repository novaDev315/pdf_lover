/**
 * Type exports for @pdflover/shared
 */

// PDF types
export type {
  PDFMetadata,
  PDFPage,
  PDFDocument,
  MergeOptions,
  SplitMode,
  PageRange,
  SplitOptions,
  ConvertOutputFormat,
  ImageQuality,
  ConvertOptions,
  CompressionLevel,
  CompressOptions,
  ProgressInfo,
  ProgressCallback,
  ProcessingResult,
  ProcessingErrorCode,
  PDFOperation,
  RotateOptions,
  WatermarkOptions,
} from './pdf.js';

// Chat types
export type {
  AIProvider,
  LocalModelId,
  MessageRole,
  Citation,
  MessageAttachment,
  Message,
  ConversationContext,
  TextChunk,
  Conversation,
  ChatOptions,
  RAGOptions,
  AIModelInfo,
  ChatCompletionResponse,
  ChatStreamChunk,
  EmbeddingOptions,
  EmbeddingResponse,
} from './chat.js';

// Storage types
export type {
  StorageProvider,
  DocumentStatus,
  StoredDocument,
  StoredChunk,
  SyncStatus,
  StorageQuota,
  DocumentFolder,
  RecentDocument,
  StorageStats,
  SchemaVersion,
  ExportFormat,
  ExportOptions,
  ImportResult,
  StorageEventType,
  StorageEvent,
  StorageEventListener,
  DocumentQueryOptions,
  QueryResult,
  DocumentBlobRecord,
  DocumentVersionSource,
  DocumentVersion,
  StoredOperationStatus,
  StoredOperationRun,
  StoredOperationArtifact,
} from './storage.js';

// Backend operation and capability contracts
export type {
  OperationEngine,
  OperationStatus,
  ServerOperationKind,
  OperationErrorCode,
  OperationError,
  OperationProgress,
  OperationArtifact,
  OperationJob,
  EngineCapability,
  ApiCapabilities,
  ApiErrorResponse,
} from './operations.js';
