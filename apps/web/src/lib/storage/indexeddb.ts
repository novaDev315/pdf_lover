/**
 * IndexedDB storage utilities for PDFLover
 * Uses Dexie.js for a cleaner IndexedDB API
 */

import Dexie, { type Table } from 'dexie';
import type {
  StoredDocument,
  Conversation,
  Message,
  DocumentFolder,
  StorageQuota,
  DocumentQueryOptions,
  QueryResult,
  StorageStats,
  DocumentStatus,
} from '@pdflover/shared';

/**
 * Document embedding entry for vector similarity search
 */
export interface DocumentEmbedding {
  /** Document ID reference */
  documentId: string;
  /** Chunk ID for locating the text */
  chunkId: string;
  /** Page number where the chunk is located */
  pageNumber: number;
  /** The embedding vector */
  embedding: number[];
  /** Timestamp when created */
  createdAt: Date;
}

/**
 * Application settings stored in IndexedDB
 */
export interface AppSettings {
  /** Setting key */
  key: string;
  /** Setting value (JSON serializable) */
  value: unknown;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Database schema version for tracking migrations
 */
const DB_VERSION = 1;

/**
 * PDFLover IndexedDB database class
 * Provides typed access to all application data stores
 */
export class PDFLoverDB extends Dexie {
  /** Documents table */
  documents!: Table<StoredDocument, string>;
  /** Conversations table */
  conversations!: Table<Conversation, string>;
  /** Messages table (separate for efficient querying) */
  messages!: Table<Message & { conversationId: string }, string>;
  /** Embeddings table for vector search */
  embeddings!: Table<DocumentEmbedding, string>;
  /** Settings table for app configuration */
  settings!: Table<AppSettings, string>;
  /** Folders table for document organization */
  folders!: Table<DocumentFolder, string>;

  constructor() {
    super('PDFLoverDB');

    this.version(DB_VERSION).stores({
      // Primary key is 'id', with indexes for common queries
      documents: 'id, filename, status, createdAt, updatedAt, lastAccessedAt, folderId, isFavorite, *tags',
      // Conversations indexed by document IDs for efficient lookup
      conversations: 'id, createdAt, updatedAt, *context.documentIds',
      // Messages indexed by conversation for efficient loading
      messages: 'id, conversationId, timestamp, role',
      // Embeddings indexed by document for cleanup and retrieval
      embeddings: '[documentId+chunkId], documentId, pageNumber',
      // Settings with simple key lookup
      settings: 'key',
      // Folders with parent hierarchy support
      folders: 'id, parentId, name, createdAt',
    });
  }

  // ============================================
  // Document Operations
  // ============================================

  /**
   * Save a document to the database
   * @param doc - The document to save
   * @returns The saved document ID
   */
  async saveDocument(doc: StoredDocument): Promise<string> {
    const now = new Date();
    const documentToSave: StoredDocument = {
      ...doc,
      updatedAt: now,
      lastAccessedAt: now,
    };

    await this.documents.put(documentToSave);
    return doc.id;
  }

  /**
   * Get a document by ID
   * @param id - The document ID
   * @returns The document or undefined if not found
   */
  async getDocument(id: string): Promise<StoredDocument | undefined> {
    const doc = await this.documents.get(id);
    if (doc) {
      // Update last accessed timestamp
      await this.documents.update(id, { lastAccessedAt: new Date() });
    }
    return doc;
  }

  /**
   * Get all documents, optionally with query options
   * @param options - Query options for filtering, sorting, and pagination
   * @returns Paginated query result
   */
  async getAllDocuments(options?: DocumentQueryOptions): Promise<QueryResult<StoredDocument>> {
    let collection = this.documents.toCollection();

    // Apply filters
    if (options?.status) {
      collection = this.documents.where('status').equals(options.status);
    }

    if (options?.folderId) {
      collection = this.documents.where('folderId').equals(options.folderId);
    }

    if (options?.isFavorite !== undefined) {
      collection = this.documents.where('isFavorite').equals(options.isFavorite ? 1 : 0);
    }

    // Get all items first for counting and filtering
    let items = await collection.toArray();

    // Apply search filter (client-side)
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      items = items.filter(
        (doc) =>
          doc.filename.toLowerCase().includes(searchLower) ||
          doc.metadata?.title?.toLowerCase().includes(searchLower) ||
          doc.fullText?.toLowerCase().includes(searchLower) ||
          doc.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply tag filter
    if (options?.tags && options.tags.length > 0) {
      items = items.filter((doc) =>
        options.tags!.some((tag: string) => doc.tags?.includes(tag))
      );
    }

    const total = items.length;

    // Apply sorting
    const sortBy = options?.sortBy ?? 'updatedAt';
    const sortDir = options?.sortDirection ?? 'desc';

    items.sort((a, b) => {
      let aVal: unknown = a[sortBy as keyof StoredDocument];
      let bVal: unknown = b[sortBy as keyof StoredDocument];

      // Handle Date comparisons
      if (aVal instanceof Date) aVal = aVal.getTime();
      if (bVal instanceof Date) bVal = bVal.getTime();

      // Handle string comparisons
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // Handle numeric comparisons
      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDir === 'asc' ? numA - numB : numB - numA;
    });

    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    const paginatedItems = items.slice(offset, offset + limit);

    return {
      items: paginatedItems,
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Delete a document and all associated data
   * @param id - The document ID to delete
   */
  async deleteDocument(id: string): Promise<void> {
    await this.transaction('rw', [this.documents, this.embeddings, this.conversations, this.messages], async () => {
      // Delete the document
      await this.documents.delete(id);

      // Delete associated embeddings
      await this.embeddings.where('documentId').equals(id).delete();

      // Find and handle conversations that reference this document
      const conversations = await this.conversations
        .filter((conv) => conv.context.documentIds.includes(id))
        .toArray();

      for (const conv of conversations) {
        if (conv.context.documentIds.length === 1) {
          // Delete conversation if this was the only document
          await this.messages.where('conversationId').equals(conv.id).delete();
          await this.conversations.delete(conv.id);
        } else {
          // Remove document from conversation context
          await this.conversations.update(conv.id, {
            context: {
              ...conv.context,
              documentIds: conv.context.documentIds.filter((docId: string) => docId !== id),
            },
            updatedAt: new Date(),
          });
        }
      }
    });
  }

  /**
   * Update a document with partial data
   * @param id - The document ID
   * @param updates - Partial document data to update
   */
  async updateDocument(id: string, updates: Partial<StoredDocument>): Promise<void> {
    await this.documents.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  /**
   * Bulk delete multiple documents
   * @param ids - Array of document IDs to delete
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.deleteDocument(id);
    }
  }

  // ============================================
  // Conversation Operations
  // ============================================

  /**
   * Save a conversation
   * @param conv - The conversation to save
   * @returns The saved conversation ID
   */
  async saveConversation(conv: Conversation): Promise<string> {
    const now = new Date();
    const conversationToSave: Conversation = {
      ...conv,
      updatedAt: now,
    };

    await this.conversations.put(conversationToSave);

    // Save messages separately for efficient querying
    for (const message of conv.messages) {
      await this.messages.put({
        ...message,
        conversationId: conv.id,
      });
    }

    return conv.id;
  }

  /**
   * Get conversations for a specific document
   * @param docId - The document ID
   * @returns Array of conversations
   */
  async getConversationsForDocument(docId: string): Promise<Conversation[]> {
    return this.conversations
      .filter((conv) => conv.context.documentIds.includes(docId))
      .toArray();
  }

  /**
   * Get a conversation by ID
   * @param id - The conversation ID
   * @returns The conversation or undefined
   */
  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  /**
   * Delete a conversation and its messages
   * @param id - The conversation ID
   */
  async deleteConversation(id: string): Promise<void> {
    await this.transaction('rw', [this.conversations, this.messages], async () => {
      await this.messages.where('conversationId').equals(id).delete();
      await this.conversations.delete(id);
    });
  }

  /**
   * Add a message to a conversation
   * @param conversationId - The conversation ID
   * @param message - The message to add
   */
  async addMessage(conversationId: string, message: Message): Promise<void> {
    await this.transaction('rw', [this.conversations, this.messages], async () => {
      // Save the message
      await this.messages.put({
        ...message,
        conversationId,
      });

      // Update conversation
      const conv = await this.conversations.get(conversationId);
      if (conv) {
        await this.conversations.update(conversationId, {
          messages: [...conv.messages, message],
          updatedAt: new Date(),
        });
      }
    });
  }

  // ============================================
  // Embeddings Operations
  // ============================================

  /**
   * Save embeddings for a document
   * @param docId - The document ID
   * @param embeddings - Array of embedding vectors
   * @param chunkInfo - Information about each chunk (pageNumber, chunkId)
   */
  async saveEmbeddings(
    docId: string,
    embeddings: number[][],
    chunkInfo?: Array<{ chunkId: string; pageNumber: number }>
  ): Promise<void> {
    const now = new Date();

    // Delete existing embeddings for this document
    await this.embeddings.where('documentId').equals(docId).delete();

    // Save new embeddings
    const embeddingsToSave: DocumentEmbedding[] = embeddings.map((embedding, index) => ({
      documentId: docId,
      chunkId: chunkInfo?.[index]?.chunkId ?? `chunk_${index}`,
      pageNumber: chunkInfo?.[index]?.pageNumber ?? 1,
      embedding,
      createdAt: now,
    }));

    await this.embeddings.bulkPut(embeddingsToSave);
  }

  /**
   * Get embeddings for a document
   * @param docId - The document ID
   * @returns Array of embedding entries
   */
  async getEmbeddings(docId: string): Promise<DocumentEmbedding[]> {
    return this.embeddings.where('documentId').equals(docId).toArray();
  }

  /**
   * Delete embeddings for a document
   * @param docId - The document ID
   */
  async deleteEmbeddings(docId: string): Promise<void> {
    await this.embeddings.where('documentId').equals(docId).delete();
  }

  // ============================================
  // Settings Operations
  // ============================================

  /**
   * Get a setting value
   * @param key - The setting key
   * @returns The setting value or undefined
   */
  async getSetting<T>(key: string): Promise<T | undefined> {
    const setting = await this.settings.get(key);
    return setting?.value as T | undefined;
  }

  /**
   * Save a setting
   * @param key - The setting key
   * @param value - The setting value
   */
  async saveSetting(key: string, value: unknown): Promise<void> {
    await this.settings.put({
      key,
      value,
      updatedAt: new Date(),
    });
  }

  /**
   * Delete a setting
   * @param key - The setting key
   */
  async deleteSetting(key: string): Promise<void> {
    await this.settings.delete(key);
  }

  // ============================================
  // Folder Operations
  // ============================================

  /**
   * Get all folders
   * @returns Array of folders
   */
  async getFolders(): Promise<DocumentFolder[]> {
    return this.folders.toArray();
  }

  /**
   * Save a folder
   * @param folder - The folder to save
   */
  async saveFolder(folder: DocumentFolder): Promise<string> {
    await this.folders.put({
      ...folder,
      updatedAt: new Date(),
    });
    return folder.id;
  }

  /**
   * Delete a folder
   * @param id - The folder ID
   * @param moveDocumentsTo - Optional folder ID to move documents to
   */
  async deleteFolder(id: string, moveDocumentsTo?: string): Promise<void> {
    await this.transaction('rw', [this.folders, this.documents], async () => {
      // Move or clear folder reference from documents
      const docsInFolder = await this.documents.where('folderId').equals(id).toArray();
      for (const doc of docsInFolder) {
        await this.documents.update(doc.id, {
          folderId: moveDocumentsTo,
          updatedAt: new Date(),
        });
      }

      // Delete child folders recursively
      const childFolders = await this.folders.where('parentId').equals(id).toArray();
      for (const child of childFolders) {
        await this.deleteFolder(child.id, moveDocumentsTo);
      }

      // Delete the folder
      await this.folders.delete(id);
    });
  }

  // ============================================
  // Storage Management
  // ============================================

  /**
   * Get storage usage information
   * @returns Storage quota information
   */
  async getStorageUsage(): Promise<StorageQuota> {
    // Get browser storage estimate
    let quota = 0;
    let used = 0;
    let isPersisted = false;

    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      quota = estimate.quota ?? 0;
      used = estimate.usage ?? 0;
    }

    if (navigator.storage && navigator.storage.persisted) {
      isPersisted = await navigator.storage.persisted();
    }

    // Get counts
    const documentCount = await this.documents.count();
    const conversationCount = await this.conversations.count();

    const available = quota - used;
    const usagePercentage = quota > 0 ? (used / quota) * 100 : 0;

    return {
      used,
      available,
      quota,
      usagePercentage,
      documentCount,
      conversationCount,
      isPersisted,
      calculatedAt: new Date(),
    };
  }

  /**
   * Get detailed storage statistics
   * @returns Storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    const documents = await this.documents.toArray();
    const conversations = await this.conversations.toArray();

    // Calculate document stats
    const totalPages = documents.reduce((sum, doc) => sum + doc.pageCount, 0);
    const documentsSize = documents.reduce((sum, doc) => sum + doc.fileSize, 0);

    // Calculate message count
    const totalMessages = conversations.reduce(
      (sum, conv) => sum + conv.messages.length,
      0
    );

    // Get documents by status
    const documentsByStatus: Record<DocumentStatus, number> = {
      pending: 0,
      processing: 0,
      ready: 0,
      error: 0,
      archived: 0,
    };

    for (const doc of documents) {
      const status = doc.status;
      if (status && status in documentsByStatus) {
        documentsByStatus[status] = (documentsByStatus[status] ?? 0) + 1;
      }
    }

    // Get documents by month
    const monthCounts = new Map<string, number>();
    for (const doc of documents) {
      const month = doc.createdAt.toISOString().slice(0, 7); // YYYY-MM
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    }

    const documentsByMonth = Array.from(monthCounts.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Get top documents by access
    const topDocuments = documents
      .filter((doc) => doc.lastAccessedAt)
      .sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime())
      .slice(0, 10)
      .map((doc) => ({
        documentId: doc.id,
        filename: doc.filename,
        thumbnail: doc.thumbnail,
        lastAccessedAt: doc.lastAccessedAt,
        accessCount: 1, // Would need a separate counter for accurate counts
      }));

    // Estimate sizes (rough calculations)
    const conversationsSize = conversations.reduce(
      (sum, conv) =>
        sum + JSON.stringify(conv.messages).length,
      0
    );

    const embeddingsCount = await this.embeddings.count();
    const embeddingsSize = embeddingsCount * 384 * 4; // Assume 384-dim float32 embeddings

    const thumbnailsSize = documents.reduce(
      (sum, doc) => sum + (doc.thumbnail?.length ?? 0),
      0
    );

    return {
      totalDocuments: documents.length,
      totalPages,
      documentsSize,
      totalConversations: conversations.length,
      totalMessages,
      conversationsSize,
      embeddingsSize,
      thumbnailsSize,
      topDocuments,
      documentsByStatus,
      documentsByMonth,
    };
  }

  /**
   * Clear all data from the database
   * Use with caution - this is irreversible
   */
  async clearAllData(): Promise<void> {
    await this.transaction(
      'rw',
      [this.documents, this.conversations, this.messages, this.embeddings, this.settings, this.folders],
      async () => {
        await this.documents.clear();
        await this.conversations.clear();
        await this.messages.clear();
        await this.embeddings.clear();
        await this.settings.clear();
        await this.folders.clear();
      }
    );
  }

  /**
   * Request persistent storage from the browser
   * @returns Whether persistence was granted
   */
  async requestPersistence(): Promise<boolean> {
    if (navigator.storage && navigator.storage.persist) {
      return navigator.storage.persist();
    }
    return false;
  }

  /**
   * Export database as JSON
   * @returns JSON string of all data
   */
  async exportData(): Promise<string> {
    const data = {
      documents: await this.documents.toArray(),
      conversations: await this.conversations.toArray(),
      folders: await this.folders.toArray(),
      settings: await this.settings.toArray(),
      exportedAt: new Date().toISOString(),
      version: DB_VERSION,
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import data from JSON
   * @param jsonData - JSON string to import
   * @param merge - Whether to merge with existing data (default: replace)
   */
  async importData(jsonData: string, merge = false): Promise<void> {
    const data = JSON.parse(jsonData);

    await this.transaction(
      'rw',
      [this.documents, this.conversations, this.folders, this.settings],
      async () => {
        if (!merge) {
          await this.clearAllData();
        }

        if (data.documents) {
          for (const doc of data.documents) {
            // Parse dates back to Date objects
            doc.createdAt = new Date(doc.createdAt);
            doc.updatedAt = new Date(doc.updatedAt);
            doc.lastAccessedAt = new Date(doc.lastAccessedAt);
            await this.documents.put(doc);
          }
        }

        if (data.conversations) {
          for (const conv of data.conversations) {
            conv.createdAt = new Date(conv.createdAt);
            conv.updatedAt = new Date(conv.updatedAt);
            for (const msg of conv.messages) {
              msg.timestamp = new Date(msg.timestamp);
            }
            await this.conversations.put(conv);
          }
        }

        if (data.folders) {
          for (const folder of data.folders) {
            folder.createdAt = new Date(folder.createdAt);
            folder.updatedAt = new Date(folder.updatedAt);
            await this.folders.put(folder);
          }
        }

        if (data.settings) {
          for (const setting of data.settings) {
            setting.updatedAt = new Date(setting.updatedAt);
            await this.settings.put(setting);
          }
        }
      }
    );
  }
}

/**
 * Singleton instance of the PDFLover database
 * Use this for all database operations
 */
export const db = new PDFLoverDB();

/**
 * Check if IndexedDB is available in the current browser
 * @returns Whether IndexedDB is supported
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Generate a unique ID for database entries
 * @returns A unique ID string
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
