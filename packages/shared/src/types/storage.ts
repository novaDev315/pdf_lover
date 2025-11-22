/**
 * Storage-related type definitions for PDFLover
 * Uses IndexedDB via Dexie.js for local-first storage
 */

import type { PDFDocument, PDFMetadata } from './pdf.js';
import type { Conversation } from './chat.js';

/**
 * Storage provider types
 */
export type StorageProvider = 'indexeddb' | 'filesystem' | 'cloud';

/**
 * Document storage status
 */
export type DocumentStatus =
  | 'pending'     // Awaiting processing
  | 'processing'  // Currently being processed
  | 'ready'       // Ready to use
  | 'error'       // Processing failed
  | 'archived';   // Archived/soft-deleted

/**
 * A document stored in IndexedDB
 */
export interface StoredDocument {
  /** Unique document ID */
  id: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  fileSize: number;
  /** Number of pages */
  pageCount: number;
  /** Document metadata */
  metadata: PDFMetadata;
  /** Document status */
  status: DocumentStatus;
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Thumbnail data URL */
  thumbnail?: string;
  /** Page thumbnails (indexed by page number) */
  pageThumbnails?: Record<number, string>;
  /** Extracted text content per page */
  textContent?: Record<number, string>;
  /** Full extracted text (concatenated) */
  fullText?: string;
  /** Text chunks for RAG */
  chunks?: StoredChunk[];
  /** Whether text has been OCR'd */
  isOCRd?: boolean;
  /** OCR language used */
  ocrLanguage?: string;
  /** Tags/labels */
  tags?: string[];
  /** User notes */
  notes?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Last accessed timestamp */
  lastAccessedAt: Date;
  /** Whether this is a favorite */
  isFavorite?: boolean;
  /** Folder/category ID */
  folderId?: string;
  /** Original file hash (SHA-256) */
  fileHash?: string;
  /** Cloud sync status */
  syncStatus?: SyncStatus;
  /** Cloud sync timestamp */
  lastSyncedAt?: Date;
}

/**
 * Stored text chunk for RAG
 */
export interface StoredChunk {
  /** Chunk ID */
  id: string;
  /** Page number */
  pageNumber: number;
  /** Chunk content */
  content: string;
  /** Embedding vector */
  embedding?: number[];
  /** Start offset in page */
  startOffset: number;
  /** End offset in page */
  endOffset: number;
}

/**
 * Cloud sync status
 */
export type SyncStatus =
  | 'synced'      // Fully synced
  | 'pending'     // Waiting to sync
  | 'syncing'     // Currently syncing
  | 'conflict'    // Sync conflict
  | 'error'       // Sync error
  | 'local-only'; // Not synced (local only)

/**
 * Storage quota information
 */
export interface StorageQuota {
  /** Total storage used in bytes */
  used: number;
  /** Total available storage in bytes */
  available: number;
  /** Storage quota in bytes (browser limit) */
  quota: number;
  /** Usage percentage (0-100) */
  usagePercentage: number;
  /** Number of documents stored */
  documentCount: number;
  /** Number of conversations stored */
  conversationCount: number;
  /** Whether storage is persisted (won't be evicted) */
  isPersisted: boolean;
  /** Last calculated timestamp */
  calculatedAt: Date;
}

/**
 * Document folder/category
 */
export interface DocumentFolder {
  /** Folder ID */
  id: string;
  /** Folder name */
  name: string;
  /** Parent folder ID (for nesting) */
  parentId?: string;
  /** Folder color */
  color?: string;
  /** Folder icon */
  icon?: string;
  /** Document count in folder */
  documentCount: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Recent document entry
 */
export interface RecentDocument {
  /** Document ID */
  documentId: string;
  /** Document filename */
  filename: string;
  /** Thumbnail */
  thumbnail?: string;
  /** Last accessed timestamp */
  lastAccessedAt: Date;
  /** Number of accesses */
  accessCount: number;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  /** Total documents */
  totalDocuments: number;
  /** Total pages across all documents */
  totalPages: number;
  /** Total storage used by documents */
  documentsSize: number;
  /** Total conversations */
  totalConversations: number;
  /** Total messages across conversations */
  totalMessages: number;
  /** Storage used by conversations */
  conversationsSize: number;
  /** Storage used by embeddings */
  embeddingsSize: number;
  /** Storage used by thumbnails */
  thumbnailsSize: number;
  /** Most accessed documents */
  topDocuments: RecentDocument[];
  /** Documents by status */
  documentsByStatus: Record<DocumentStatus, number>;
  /** Documents by month */
  documentsByMonth: Array<{ month: string; count: number }>;
}

/**
 * Database schema version info
 */
export interface SchemaVersion {
  /** Current version number */
  version: number;
  /** Upgrade timestamp */
  upgradedAt: Date;
  /** Previous version (if upgraded) */
  previousVersion?: number;
}

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'zip' | 'pdf-bundle';

/**
 * Export options
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Include document files */
  includeDocuments?: boolean;
  /** Include conversations */
  includeConversations?: boolean;
  /** Include embeddings */
  includeEmbeddings?: boolean;
  /** Document IDs to export (undefined = all) */
  documentIds?: string[];
  /** Conversation IDs to export (undefined = all) */
  conversationIds?: string[];
}

/**
 * Import result
 */
export interface ImportResult {
  /** Whether import was successful */
  success: boolean;
  /** Number of documents imported */
  documentsImported: number;
  /** Number of conversations imported */
  conversationsImported: number;
  /** Skipped items (duplicates) */
  skipped: number;
  /** Errors encountered */
  errors: string[];
  /** Import duration in milliseconds */
  duration: number;
}

/**
 * Storage event types
 */
export type StorageEventType =
  | 'document-added'
  | 'document-updated'
  | 'document-deleted'
  | 'conversation-added'
  | 'conversation-updated'
  | 'conversation-deleted'
  | 'quota-exceeded'
  | 'sync-started'
  | 'sync-completed'
  | 'sync-error';

/**
 * Storage event
 */
export interface StorageEvent {
  /** Event type */
  type: StorageEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Associated document ID */
  documentId?: string;
  /** Associated conversation ID */
  conversationId?: string;
  /** Additional event data */
  data?: Record<string, unknown>;
}

/**
 * Storage event listener
 */
export type StorageEventListener = (event: StorageEvent) => void;

/**
 * Query options for listing documents
 */
export interface DocumentQueryOptions {
  /** Filter by status */
  status?: DocumentStatus;
  /** Filter by folder */
  folderId?: string;
  /** Filter by tags */
  tags?: string[];
  /** Filter by favorites */
  isFavorite?: boolean;
  /** Search query (filename, title, content) */
  search?: string;
  /** Sort field */
  sortBy?: 'filename' | 'createdAt' | 'updatedAt' | 'lastAccessedAt' | 'fileSize' | 'pageCount';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Pagination offset */
  offset?: number;
  /** Pagination limit */
  limit?: number;
}

/**
 * Query result with pagination
 */
export interface QueryResult<T> {
  /** Result items */
  items: T[];
  /** Total count (without pagination) */
  total: number;
  /** Current offset */
  offset: number;
  /** Current limit */
  limit: number;
  /** Whether there are more items */
  hasMore: boolean;
}
