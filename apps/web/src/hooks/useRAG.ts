/**
 * React Hook for RAG (Retrieval Augmented Generation) Operations
 * Provides document indexing, context retrieval, and cache management
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  createDocumentIndex,
  queryWithContext,
  isDocumentIndexed,
  getDocumentChunkCount,
  clearDocumentIndex,
  type IndexingProgress,
  type RAGContext,
  type PDFDocument,
} from '@/lib/ai/rag'

/**
 * State for document indexing
 */
export interface IndexingState {
  /** Whether indexing is in progress */
  isIndexing: boolean
  /** Current progress information */
  progress: IndexingProgress | null
  /** Error message if indexing failed */
  error: string | null
  /** Whether the document is indexed */
  isIndexed: boolean
  /** Number of chunks in the index */
  chunkCount: number
}

/**
 * State for RAG query
 */
export interface QueryState {
  /** Whether a query is in progress */
  isQuerying: boolean
  /** Last query result */
  result: RAGQueryResult | null
  /** Error message if query failed */
  error: string | null
}

/**
 * Options for the useRAG hook
 */
export interface UseRAGOptions {
  /** Chunk size for text splitting (default: 512) */
  chunkSize?: number
  /** Overlap between chunks (default: 50) */
  chunkOverlap?: number
  /** Number of chunks to retrieve (default: 5) */
  topK?: number
  /** Minimum similarity threshold (default: 0.3) */
  minSimilarity?: number
  /** Maximum context length in characters (default: 4000) */
  maxContextLength?: number
  /** Whether to persist embeddings to IndexedDB (default: true) */
  persist?: boolean
  /** Auto-index on document load */
  autoIndex?: boolean
}

/**
 * Return type for the useRAG hook
 */
export interface UseRAGReturn {
  /** Current indexing state */
  indexingState: IndexingState
  /** Current query state */
  queryState: QueryState

  /** Index a document for RAG */
  indexDocument: (document: PDFDocument, forceReindex?: boolean) => Promise<void>
  /** Query the indexed document */
  query: (question: string, documentId?: string) => Promise<RAGContext | null>
  /** Clear the document index */
  clearIndex: (documentId: string) => Promise<void>
  /** Check if a document is indexed */
  checkIndexed: (documentId: string) => boolean
  /** Get chunk count for a document */
  getChunkCount: (documentId: string) => number
  /** Reset all state */
  reset: () => void
}

/**
 * Hook for RAG operations
 *
 * @param options - Configuration options
 * @returns RAG operations and state
 *
 * @example
 * ```tsx
 * function ChatWithPDF({ document }) {
 *   const {
 *     indexingState,
 *     queryState,
 *     indexDocument,
 *     query,
 *   } = useRAG({
 *     chunkSize: 512,
 *     topK: 5,
 *   });
 *
 *   useEffect(() => {
 *     indexDocument(document);
 *   }, [document]);
 *
 *   const handleQuestion = async (question: string) => {
 *     const context = await query(question, document.id);
 *     if (context) {
 *       // Use context for AI response generation
 *     }
 *   };
 *
 *   if (indexingState.isIndexing) {
 *     return <Progress value={indexingState.progress?.progress} />;
 *   }
 *
 *   return <ChatInterface onSend={handleQuestion} />;
 * }
 * ```
 */
export function useRAG(options: UseRAGOptions = {}): UseRAGReturn {
  const {
    chunkSize = 512,
    chunkOverlap = 50,
    topK = 5,
    minSimilarity = 0.3,
    maxContextLength = 4000,
    persist = true,
  } = options

  // Indexing state
  const [indexingState, setIndexingState] = useState<IndexingState>({
    isIndexing: false,
    progress: null,
    error: null,
    isIndexed: false,
    chunkCount: 0,
  })

  // Query state
  const [queryState, setQueryState] = useState<QueryState>({
    isQuerying: false,
    result: null,
    error: null,
  })

  // Track current document ID for state updates
  const currentDocumentIdRef = useRef<string | null>(null)

  // Abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Index a document for RAG
   */
  const indexDocumentHandler = useCallback(
    async (document: PDFDocument, forceReindex = false) => {
      // Cancel any ongoing indexing
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      currentDocumentIdRef.current = document.id

      // Check if already indexed (unless force reindex)
      if (!forceReindex && isDocumentIndexed(document.id)) {
        const chunkCount = getDocumentChunkCount(document.id)
        setIndexingState({
          isIndexing: false,
          progress: { stage: 'complete', progress: 100 },
          error: null,
          isIndexed: true,
          chunkCount,
        })
        return
      }

      setIndexingState({
        isIndexing: true,
        progress: { stage: 'initializing', progress: 0 },
        error: null,
        isIndexed: false,
        chunkCount: 0,
      })

      try {
        const chunks = await createDocumentIndex(
          document.id,
          document,
          {
            chunkSize,
            chunkOverlap,
            persist,
            forceReindex,
          },
          (progress) => {
            // Only update if this is still the current document
            if (currentDocumentIdRef.current === document.id) {
              setIndexingState((prev) => ({
                ...prev,
                progress,
                chunkCount: progress.totalChunks || prev.chunkCount,
              }))
            }
          }
        )

        // Final state update
        if (currentDocumentIdRef.current === document.id) {
          setIndexingState({
            isIndexing: false,
            progress: { stage: 'complete', progress: 100 },
            error: null,
            isIndexed: true,
            chunkCount: chunks.length,
          })
        }
      } catch (error) {
        // Only update error if this is still the current document
        if (currentDocumentIdRef.current === document.id) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to index document'
          setIndexingState((prev) => ({
            ...prev,
            isIndexing: false,
            progress: { stage: 'error', progress: 0, error: errorMessage },
            error: errorMessage,
          }))
        }
      }
    },
    [chunkSize, chunkOverlap, persist]
  )

  /**
   * Query the indexed document
   */
  const queryHandler = useCallback(
    async (question: string, documentId?: string): Promise<RAGContext | null> => {
      setQueryState({
        isQuerying: true,
        result: null,
        error: null,
      })

      try {
        const result = await queryWithContext(question, documentId, {
          topK,
          minSimilarity,
          maxContextLength,
        })

        setQueryState({
          isQuerying: false,
          result,
          error: null,
        })

        return result.context
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to query document'
        setQueryState({
          isQuerying: false,
          result: null,
          error: errorMessage,
        })
        return null
      }
    },
    [topK, minSimilarity, maxContextLength]
  )

  /**
   * Clear the document index
   */
  const clearIndexHandler = useCallback(async (documentId: string) => {
    await clearDocumentIndex(documentId, true)

    if (currentDocumentIdRef.current === documentId) {
      setIndexingState({
        isIndexing: false,
        progress: null,
        error: null,
        isIndexed: false,
        chunkCount: 0,
      })
    }
  }, [])

  /**
   * Check if a document is indexed
   */
  const checkIndexedHandler = useCallback((documentId: string): boolean => {
    return isDocumentIndexed(documentId)
  }, [])

  /**
   * Get chunk count for a document
   */
  const getChunkCountHandler = useCallback((documentId: string): number => {
    return getDocumentChunkCount(documentId)
  }, [])

  /**
   * Reset all state
   */
  const resetHandler = useCallback(() => {
    currentDocumentIdRef.current = null
    setIndexingState({
      isIndexing: false,
      progress: null,
      error: null,
      isIndexed: false,
      chunkCount: 0,
    })
    setQueryState({
      isQuerying: false,
      result: null,
      error: null,
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    indexingState,
    queryState,
    indexDocument: indexDocumentHandler,
    query: queryHandler,
    clearIndex: clearIndexHandler,
    checkIndexed: checkIndexedHandler,
    getChunkCount: getChunkCountHandler,
    reset: resetHandler,
  }
}

/**
 * Hook for tracking indexing progress with visual state
 */
export function useIndexingProgress() {
  const [progress, setProgress] = useState<IndexingProgress | null>(null)

  const updateProgress = useCallback((newProgress: IndexingProgress) => {
    setProgress(newProgress)
  }, [])

  const reset = useCallback(() => {
    setProgress(null)
  }, [])

  const progressPercentage = progress?.progress ?? 0

  const progressLabel = progress
    ? getProgressLabel(progress)
    : ''

  return {
    progress,
    progressPercentage,
    progressLabel,
    updateProgress,
    reset,
    isComplete: progress?.stage === 'complete',
    isError: progress?.stage === 'error',
    isActive: progress !== null && progress.stage !== 'complete' && progress.stage !== 'error',
  }
}

/**
 * Get a human-readable label for indexing progress
 */
function getProgressLabel(progress: IndexingProgress): string {
  switch (progress.stage) {
    case 'initializing':
      return 'Initializing embedding model...'
    case 'chunking':
      return 'Splitting document into chunks...'
    case 'embedding':
      if (progress.totalChunks) {
        return `Generating embeddings (${progress.processedChunks || 0}/${progress.totalChunks} chunks)...`
      }
      return 'Generating embeddings...'
    case 'storing':
      return 'Storing embeddings...'
    case 'complete':
      return 'Indexing complete'
    case 'error':
      return progress.error || 'Indexing failed'
    default:
      return 'Processing...'
  }
}

export default useRAG
