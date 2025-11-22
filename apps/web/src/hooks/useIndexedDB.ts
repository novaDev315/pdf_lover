/**
 * React hook for IndexedDB operations
 * Wraps PDFLoverDB with automatic error handling and loading states
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { db, isIndexedDBAvailable } from '@/lib/storage';
import type {
  StoredDocument,
  Conversation,
  Message,
  DocumentFolder,
  DocumentQueryOptions,
  QueryResult,
  StorageStats,
} from '@pdflover/shared';
import type { DocumentEmbedding } from '@/lib/storage';

/**
 * Operation state for async operations
 */
export interface OperationState<T = unknown> {
  /** Whether the operation is in progress */
  isLoading: boolean;
  /** Error message if the operation failed */
  error: string | null;
  /** The result data */
  data: T | null;
}

/**
 * Result of a mutation operation
 */
export interface MutationResult<T = void> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The result data if any */
  data?: T;
  /** Error message if failed */
  error?: string;
}

/**
 * Return type for the useIndexedDB hook
 */
export interface UseIndexedDBReturn {
  /** Whether IndexedDB is available in this browser */
  isAvailable: boolean;
  /** Whether the database is ready to use */
  isReady: boolean;
  /** General error state */
  error: string | null;

  // Document operations
  /** Save a document */
  saveDocument: (doc: StoredDocument) => Promise<MutationResult<string>>;
  /** Get a document by ID */
  getDocument: (id: string) => Promise<StoredDocument | null>;
  /** Get all documents with optional query options */
  getAllDocuments: (options?: DocumentQueryOptions) => Promise<QueryResult<StoredDocument>>;
  /** Delete a document */
  deleteDocument: (id: string) => Promise<MutationResult>;
  /** Update a document */
  updateDocument: (id: string, updates: Partial<StoredDocument>) => Promise<MutationResult>;
  /** Bulk delete documents */
  deleteDocuments: (ids: string[]) => Promise<MutationResult>;

  // Conversation operations
  /** Save a conversation */
  saveConversation: (conv: Conversation) => Promise<MutationResult<string>>;
  /** Get conversations for a document */
  getConversationsForDocument: (docId: string) => Promise<Conversation[]>;
  /** Get a conversation by ID */
  getConversation: (id: string) => Promise<Conversation | null>;
  /** Delete a conversation */
  deleteConversation: (id: string) => Promise<MutationResult>;
  /** Add a message to a conversation */
  addMessage: (conversationId: string, message: Message) => Promise<MutationResult>;

  // Embeddings operations
  /** Save embeddings for a document */
  saveEmbeddings: (
    docId: string,
    embeddings: number[][],
    chunkInfo?: Array<{ chunkId: string; pageNumber: number }>
  ) => Promise<MutationResult>;
  /** Get embeddings for a document */
  getEmbeddings: (docId: string) => Promise<DocumentEmbedding[]>;
  /** Delete embeddings for a document */
  deleteEmbeddings: (docId: string) => Promise<MutationResult>;

  // Settings operations
  /** Get a setting value */
  getSetting: <T>(key: string) => Promise<T | null>;
  /** Save a setting */
  saveSetting: (key: string, value: unknown) => Promise<MutationResult>;
  /** Delete a setting */
  deleteSetting: (key: string) => Promise<MutationResult>;

  // Folder operations
  /** Get all folders */
  getFolders: () => Promise<DocumentFolder[]>;
  /** Save a folder */
  saveFolder: (folder: DocumentFolder) => Promise<MutationResult<string>>;
  /** Delete a folder */
  deleteFolder: (id: string, moveDocumentsTo?: string) => Promise<MutationResult>;

  // Storage management
  /** Get storage statistics */
  getStorageStats: () => Promise<StorageStats | null>;
  /** Clear all data */
  clearAllData: () => Promise<MutationResult>;
  /** Export data as JSON */
  exportData: () => Promise<string | null>;
  /** Import data from JSON */
  importData: (jsonData: string, merge?: boolean) => Promise<MutationResult>;
  /** Request persistent storage */
  requestPersistence: () => Promise<boolean>;

  // Cache invalidation
  /** Invalidate cached queries (trigger refetch) */
  invalidateQueries: () => void;
  /** Query version for dependency tracking */
  queryVersion: number;
}

/**
 * Hook for IndexedDB operations with automatic error handling
 *
 * @returns Object containing database operations and state
 *
 * @example
 * ```tsx
 * function DocumentList() {
 *   const {
 *     isAvailable,
 *     getAllDocuments,
 *     deleteDocument,
 *     queryVersion
 *   } = useIndexedDB();
 *
 *   const [documents, setDocuments] = useState<StoredDocument[]>([]);
 *
 *   useEffect(() => {
 *     if (isAvailable) {
 *       getAllDocuments().then(result => setDocuments(result.items));
 *     }
 *   }, [isAvailable, queryVersion]);
 *
 *   const handleDelete = async (id: string) => {
 *     const result = await deleteDocument(id);
 *     if (result.success) {
 *       // Document deleted successfully
 *     }
 *   };
 *
 *   return (
 *     <ul>
 *       {documents.map(doc => (
 *         <li key={doc.id}>{doc.filename}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useIndexedDB(): UseIndexedDBReturn {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryVersion, setQueryVersion] = useState(0);
  const isAvailable = useRef(isIndexedDBAvailable());

  // Initialize database connection
  useEffect(() => {
    if (!isAvailable.current) {
      setError('IndexedDB is not available in this browser');
      return;
    }

    // Dexie opens automatically on first query, but we can verify it works
    const checkReady = async () => {
      try {
        await db.documents.count();
        setIsReady(true);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize database';
        setError(message);
        setIsReady(false);
      }
    };

    checkReady();
  }, []);

  /**
   * Invalidate queries to trigger refetch
   */
  const invalidateQueries = useCallback(() => {
    setQueryVersion((v) => v + 1);
  }, []);

  /**
   * Wrap an async operation with error handling
   */
  const withErrorHandling = useCallback(
    async <T>(operation: () => Promise<T>, errorMessage: string): Promise<T | null> => {
      if (!isAvailable.current) {
        setError('IndexedDB is not available');
        return null;
      }

      try {
        return await operation();
      } catch (err) {
        const message = err instanceof Error ? err.message : errorMessage;
        console.error(errorMessage, err);
        setError(message);
        return null;
      }
    },
    []
  );

  /**
   * Wrap a mutation operation with error handling and result formatting
   */
  const withMutationHandling = useCallback(
    async <T = void>(
      operation: () => Promise<T>,
      errorMessage: string,
      shouldInvalidate = true
    ): Promise<MutationResult<T>> => {
      if (!isAvailable.current) {
        return { success: false, error: 'IndexedDB is not available' };
      }

      try {
        const result = await operation();
        if (shouldInvalidate) {
          invalidateQueries();
        }
        return { success: true, data: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : errorMessage;
        console.error(errorMessage, err);
        return { success: false, error: message };
      }
    },
    [invalidateQueries]
  );

  // ============================================
  // Document Operations
  // ============================================

  const saveDocument = useCallback(
    async (doc: StoredDocument): Promise<MutationResult<string>> => {
      return withMutationHandling(
        () => db.saveDocument(doc),
        'Failed to save document'
      );
    },
    [withMutationHandling]
  );

  const getDocument = useCallback(
    async (id: string): Promise<StoredDocument | null> => {
      return withErrorHandling(
        () => db.getDocument(id).then((doc) => doc ?? null),
        'Failed to get document'
      );
    },
    [withErrorHandling]
  );

  const getAllDocuments = useCallback(
    async (options?: DocumentQueryOptions): Promise<QueryResult<StoredDocument>> => {
      const result = await withErrorHandling(
        () => db.getAllDocuments(options),
        'Failed to get documents'
      );

      return result ?? {
        items: [],
        total: 0,
        offset: 0,
        limit: 50,
        hasMore: false,
      };
    },
    [withErrorHandling]
  );

  const deleteDocument = useCallback(
    async (id: string): Promise<MutationResult> => {
      return withMutationHandling(
        () => db.deleteDocument(id),
        'Failed to delete document'
      );
    },
    [withMutationHandling]
  );

  const updateDocument = useCallback(
    async (id: string, updates: Partial<StoredDocument>): Promise<MutationResult> => {
      return withMutationHandling(
        () => db.updateDocument(id, updates),
        'Failed to update document'
      );
    },
    [withMutationHandling]
  );

  const deleteDocuments = useCallback(
    async (ids: string[]): Promise<MutationResult> => {
      return withMutationHandling(
        () => db.deleteDocuments(ids),
        'Failed to delete documents'
      );
    },
    [withMutationHandling]
  );

  // ============================================
  // Conversation Operations
  // ============================================

  const saveConversation = useCallback(
    async (conv: Conversation): Promise<MutationResult<string>> => {
      return withMutationHandling(
        () => db.saveConversation(conv),
        'Failed to save conversation'
      );
    },
    [withMutationHandling]
  );

  const getConversationsForDocument = useCallback(
    async (docId: string): Promise<Conversation[]> => {
      const result = await withErrorHandling(
        () => db.getConversationsForDocument(docId),
        'Failed to get conversations'
      );
      return result ?? [];
    },
    [withErrorHandling]
  );

  const getConversation = useCallback(
    async (id: string): Promise<Conversation | null> => {
      return withErrorHandling(
        () => db.getConversation(id).then((conv) => conv ?? null),
        'Failed to get conversation'
      );
    },
    [withErrorHandling]
  );

  const deleteConversation = useCallback(
    async (id: string): Promise<MutationResult> => {
      return withMutationHandling(
        () => db.deleteConversation(id),
        'Failed to delete conversation'
      );
    },
    [withMutationHandling]
  );

  const addMessage = useCallback(
    async (conversationId: string, message: Message): Promise<MutationResult> => {
      return withMutationHandling(
        () => db.addMessage(conversationId, message),
        'Failed to add message'
      );
    },
    [withMutationHandling]
  );

  // ============================================
  // Embeddings Operations
  // ============================================

  const saveEmbeddings = useCallback(
    async (
      docId: string,
      embeddings: number[][],
      chunkInfo?: Array<{ chunkId: string; pageNumber: number }>
    ): Promise<MutationResult> => {
      return withMutationHandling(
        () => db.saveEmbeddings(docId, embeddings, chunkInfo),
        'Failed to save embeddings',
        false // Don't invalidate queries for embeddings
      );
    },
    [withMutationHandling]
  );

  const getEmbeddings = useCallback(
    async (docId: string): Promise<DocumentEmbedding[]> => {
      const result = await withErrorHandling(
        () => db.getEmbeddings(docId),
        'Failed to get embeddings'
      );
      return result ?? [];
    },
    [withErrorHandling]
  );

  const deleteEmbeddings = useCallback(
    async (docId: string): Promise<MutationResult> => {
      return withMutationHandling(
        () => db.deleteEmbeddings(docId),
        'Failed to delete embeddings',
        false
      );
    },
    [withMutationHandling]
  );

  // ============================================
  // Settings Operations
  // ============================================

  const getSetting = useCallback(
    async <T>(key: string): Promise<T | null> => {
      return withErrorHandling(
        () => db.getSetting<T>(key).then((val) => val ?? null),
        'Failed to get setting'
      );
    },
    [withErrorHandling]
  );

  const saveSetting = useCallback(
    async (key: string, value: unknown): Promise<MutationResult> => {
      return withMutationHandling(
        () => db.saveSetting(key, value),
        'Failed to save setting',
        false
      );
    },
    [withMutationHandling]
  );

  const deleteSetting = useCallback(
    async (key: string): Promise<MutationResult> => {
      return withMutationHandling(
        () => db.deleteSetting(key),
        'Failed to delete setting',
        false
      );
    },
    [withMutationHandling]
  );

  // ============================================
  // Folder Operations
  // ============================================

  const getFolders = useCallback(async (): Promise<DocumentFolder[]> => {
    const result = await withErrorHandling(
      () => db.getFolders(),
      'Failed to get folders'
    );
    return result ?? [];
  }, [withErrorHandling]);

  const saveFolder = useCallback(
    async (folder: DocumentFolder): Promise<MutationResult<string>> => {
      return withMutationHandling(
        () => db.saveFolder(folder),
        'Failed to save folder'
      );
    },
    [withMutationHandling]
  );

  const deleteFolder = useCallback(
    async (id: string, moveDocumentsTo?: string): Promise<MutationResult> => {
      return withMutationHandling(
        () => db.deleteFolder(id, moveDocumentsTo),
        'Failed to delete folder'
      );
    },
    [withMutationHandling]
  );

  // ============================================
  // Storage Management
  // ============================================

  const getStorageStats = useCallback(async (): Promise<StorageStats | null> => {
    return withErrorHandling(
      () => db.getStorageStats(),
      'Failed to get storage stats'
    );
  }, [withErrorHandling]);

  const clearAllData = useCallback(async (): Promise<MutationResult> => {
    return withMutationHandling(
      () => db.clearAllData(),
      'Failed to clear all data'
    );
  }, [withMutationHandling]);

  const exportData = useCallback(async (): Promise<string | null> => {
    return withErrorHandling(() => db.exportData(), 'Failed to export data');
  }, [withErrorHandling]);

  const importData = useCallback(
    async (jsonData: string, merge = false): Promise<MutationResult> => {
      return withMutationHandling(
        () => db.importData(jsonData, merge),
        'Failed to import data'
      );
    },
    [withMutationHandling]
  );

  const requestPersistence = useCallback(async (): Promise<boolean> => {
    const result = await withErrorHandling(
      () => db.requestPersistence(),
      'Failed to request persistence'
    );
    return result ?? false;
  }, [withErrorHandling]);

  return {
    isAvailable: isAvailable.current,
    isReady,
    error,

    // Documents
    saveDocument,
    getDocument,
    getAllDocuments,
    deleteDocument,
    updateDocument,
    deleteDocuments,

    // Conversations
    saveConversation,
    getConversationsForDocument,
    getConversation,
    deleteConversation,
    addMessage,

    // Embeddings
    saveEmbeddings,
    getEmbeddings,
    deleteEmbeddings,

    // Settings
    getSetting,
    saveSetting,
    deleteSetting,

    // Folders
    getFolders,
    saveFolder,
    deleteFolder,

    // Storage
    getStorageStats,
    clearAllData,
    exportData,
    importData,
    requestPersistence,

    // Query invalidation
    invalidateQueries,
    queryVersion,
  };
}

export default useIndexedDB;
