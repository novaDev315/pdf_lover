/**
 * Text Embeddings for RAG (Retrieval Augmented Generation)
 * Generates embeddings and performs similarity search in browser
 */

import type {
  TextChunk,
  EmbeddingOptions,
  EmbeddingResponse,
  Citation,
} from '@pdflover/shared'
import { generateId } from '@/lib/utils'

/**
 * Embedding model state
 */
interface EmbeddingModelState {
  model: unknown | null
  isLoading: boolean
  error: string | null
}

/**
 * Global embedding model state
 */
let embeddingModelState: EmbeddingModelState = {
  model: null,
  isLoading: false,
  error: null,
}

/**
 * Default embedding model
 */
const DEFAULT_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'

/**
 * Progress callback for model loading
 */
export type EmbeddingLoadProgressCallback = (progress: {
  status: string
  progress?: number
}) => void

/**
 * Initialize the embedding model
 */
export async function initializeEmbeddingModel(
  modelId: string = DEFAULT_EMBEDDING_MODEL,
  onProgress?: EmbeddingLoadProgressCallback
): Promise<{ success: boolean; error?: string }> {
  // Check if already loaded
  if (embeddingModelState.model) {
    return { success: true }
  }

  // Prevent concurrent initialization
  if (embeddingModelState.isLoading) {
    return { success: false, error: 'Model is already loading' }
  }

  embeddingModelState.isLoading = true
  embeddingModelState.error = null

  try {
    onProgress?.({ status: 'loading', progress: 0 })

    // Dynamic import for code splitting
    const { pipeline, env } = await import('@xenova/transformers')

    // Configure Transformers.js
    env.allowLocalModels = false
    env.useBrowserCache = true

    // Load feature-extraction pipeline
    const extractor = await pipeline('feature-extraction', modelId, {
      progress_callback: (progressData: { progress?: number }) => {
        onProgress?.({
          status: 'loading',
          progress: progressData.progress,
        })
      },
    })

    embeddingModelState.model = extractor
    embeddingModelState.isLoading = false

    onProgress?.({ status: 'ready', progress: 100 })

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load embedding model'
    embeddingModelState.error = errorMessage
    embeddingModelState.isLoading = false
    onProgress?.({ status: 'error' })
    return { success: false, error: errorMessage }
  }
}

/**
 * Check if embedding model is ready
 */
export function isEmbeddingModelReady(): boolean {
  return embeddingModelState.model !== null && !embeddingModelState.isLoading
}

/**
 * Generate embeddings for text chunks
 */
export async function generateEmbeddings(
  texts: string[],
  options: EmbeddingOptions = {}
): Promise<EmbeddingResponse> {
  const startTime = performance.now()
  const batchSize = options.batchSize ?? 8

  // Ensure model is loaded
  if (!embeddingModelState.model) {
    const result = await initializeEmbeddingModel(options.modelId)
    if (!result.success) {
      throw new Error(result.error || 'Failed to initialize embedding model')
    }
  }

  const extractor = embeddingModelState.model as (
    input: string[],
    options: { pooling: string; normalize: boolean }
  ) => Promise<{ tolist(): number[][] }>

  const allEmbeddings: number[][] = []

  // Process in batches
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const output = await extractor(batch, { pooling: 'mean', normalize: true })
    const embeddings = output.tolist()
    allEmbeddings.push(...embeddings)
  }

  const duration = performance.now() - startTime

  return {
    embeddings: allEmbeddings,
    model: DEFAULT_EMBEDDING_MODEL,
    totalTokens: texts.join(' ').length / 4, // Rough estimate
    duration,
  }
}

/**
 * Generate embedding for a single text
 */
export async function generateSingleEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> {
  const response = await generateEmbeddings([text], options)
  return response.embeddings[0]
}

/**
 * Chunk text into smaller pieces for embedding
 */
export function chunkText(
  text: string,
  documentId: string,
  pageNumber: number,
  chunkSize: number = 512,
  chunkOverlap: number = 50
): TextChunk[] {
  const chunks: TextChunk[] = []

  // Clean and normalize text
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, '\n')
    .trim()

  if (cleanedText.length <= chunkSize) {
    // Text fits in a single chunk
    chunks.push({
      id: generateId(),
      documentId,
      pageNumber,
      content: cleanedText,
      startOffset: 0,
      endOffset: cleanedText.length,
    })
    return chunks
  }

  // Split into sentences for better chunk boundaries
  const sentences = cleanedText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanedText]

  let currentChunk = ''
  let startOffset = 0
  let currentOffset = 0

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()

    if (currentChunk.length + trimmedSentence.length + 1 <= chunkSize) {
      // Add sentence to current chunk
      currentChunk = currentChunk
        ? `${currentChunk} ${trimmedSentence}`
        : trimmedSentence
    } else {
      // Save current chunk and start a new one
      if (currentChunk) {
        chunks.push({
          id: generateId(),
          documentId,
          pageNumber,
          content: currentChunk,
          startOffset,
          endOffset: currentOffset,
        })

        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-chunkOverlap)
        startOffset = currentOffset - overlapText.length
        currentChunk = overlapText + ' ' + trimmedSentence
      } else {
        // Sentence itself is too long, split it
        const words = trimmedSentence.split(' ')
        let wordChunk = ''
        for (const word of words) {
          if (wordChunk.length + word.length + 1 <= chunkSize) {
            wordChunk = wordChunk ? `${wordChunk} ${word}` : word
          } else {
            if (wordChunk) {
              chunks.push({
                id: generateId(),
                documentId,
                pageNumber,
                content: wordChunk,
                startOffset,
                endOffset: currentOffset,
              })
              startOffset = currentOffset
            }
            wordChunk = word
          }
        }
        currentChunk = wordChunk
      }
    }

    currentOffset += sentence.length
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      id: generateId(),
      documentId,
      pageNumber,
      content: currentChunk.trim(),
      startOffset,
      endOffset: cleanedText.length,
    })
  }

  return chunks
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0

  return dotProduct / magnitude
}

/**
 * Search result with similarity score
 */
export interface SimilarityResult {
  chunk: TextChunk
  similarity: number
}

/**
 * Search for similar chunks using vector similarity
 */
export async function searchSimilarChunks(
  query: string,
  chunks: TextChunk[],
  topK: number = 5,
  minSimilarity: number = 0.3
): Promise<SimilarityResult[]> {
  if (chunks.length === 0) {
    return []
  }

  // Generate query embedding
  const queryEmbedding = await generateSingleEmbedding(query)

  // Ensure all chunks have embeddings
  const chunksToEmbed = chunks.filter((c) => !c.embedding)
  if (chunksToEmbed.length > 0) {
    const embeddings = await generateEmbeddings(chunksToEmbed.map((c) => c.content))
    for (let i = 0; i < chunksToEmbed.length; i++) {
      chunksToEmbed[i].embedding = embeddings.embeddings[i]
    }
  }

  // Calculate similarities
  const results: SimilarityResult[] = chunks
    .filter((chunk) => chunk.embedding)
    .map((chunk) => ({
      chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding!),
    }))
    .filter((result) => result.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)

  return results
}

/**
 * Build context string from search results
 */
export function buildContextFromResults(
  results: SimilarityResult[],
  maxLength: number = 4000
): string {
  const contextParts: string[] = []
  let currentLength = 0

  for (const result of results) {
    const contextEntry = `[Page ${result.chunk.pageNumber}]: ${result.chunk.content}`

    if (currentLength + contextEntry.length > maxLength) {
      // Truncate if we're over the limit
      const remaining = maxLength - currentLength
      if (remaining > 100) {
        contextParts.push(contextEntry.slice(0, remaining) + '...')
      }
      break
    }

    contextParts.push(contextEntry)
    currentLength += contextEntry.length + 2 // +2 for newlines
  }

  return contextParts.join('\n\n')
}

/**
 * Convert similarity results to citations
 */
export function resultsToCitations(
  results: SimilarityResult[],
  documentName: string
): Citation[] {
  return results.map((result) => ({
    documentId: result.chunk.documentId,
    documentName,
    pageNumber: result.chunk.pageNumber,
    excerpt: result.chunk.content.slice(0, 200),
    startOffset: result.chunk.startOffset,
    endOffset: result.chunk.endOffset,
    confidence: result.similarity,
  }))
}

/**
 * IndexedDB-backed vector store for document embeddings
 * Provides persistent storage with in-memory caching for performance
 */
export class VectorStore {
  private chunks: Map<string, TextChunk[]> = new Map()
  private documentNames: Map<string, string> = new Map()
  private indexedDocuments: Set<string> = new Set()
  private db: import('@/lib/storage').PDFLoverDB | null = null

  /**
   * Initialize database connection for persistence
   */
  async initialize(): Promise<void> {
    if (!this.db) {
      const { db } = await import('@/lib/storage')
      this.db = db
    }
  }

  /**
   * Add chunks for a document (in-memory and optionally persisted)
   */
  addDocument(documentId: string, documentName: string, chunks: TextChunk[]): void {
    this.chunks.set(documentId, chunks)
    this.documentNames.set(documentId, documentName)
    this.indexedDocuments.add(documentId)
  }

  /**
   * Persist document embeddings to IndexedDB
   */
  async persistDocument(documentId: string): Promise<void> {
    await this.initialize()
    const chunks = this.chunks.get(documentId)
    if (!chunks || !this.db) return

    const embeddings = chunks
      .filter((c) => c.embedding)
      .map((c) => c.embedding!)

    const chunkInfo = chunks.map((c) => ({
      chunkId: c.id,
      pageNumber: c.pageNumber,
    }))

    await this.db.saveEmbeddings(documentId, embeddings, chunkInfo)
  }

  /**
   * Load document embeddings from IndexedDB
   */
  async loadDocument(
    documentId: string,
    documentName: string,
    chunks: TextChunk[]
  ): Promise<boolean> {
    await this.initialize()
    if (!this.db) return false

    try {
      const storedEmbeddings = await this.db.getEmbeddings(documentId)
      if (storedEmbeddings.length === 0) return false

      // Create a map of chunkId to embedding
      const embeddingMap = new Map<string, number[]>()
      for (const stored of storedEmbeddings) {
        embeddingMap.set(stored.chunkId, stored.embedding)
      }

      // Attach embeddings to chunks
      let attachedCount = 0
      for (const chunk of chunks) {
        const embedding = embeddingMap.get(chunk.id)
        if (embedding) {
          chunk.embedding = embedding
          attachedCount++
        }
      }

      if (attachedCount > 0) {
        this.addDocument(documentId, documentName, chunks)
        return true
      }

      return false
    } catch (error) {
      console.error('Failed to load embeddings from IndexedDB:', error)
      return false
    }
  }

  /**
   * Check if a document is indexed
   */
  isDocumentIndexed(documentId: string): boolean {
    return this.indexedDocuments.has(documentId)
  }

  /**
   * Remove a document from memory and optionally from storage
   */
  async removeDocument(documentId: string, removeFromStorage = false): Promise<void> {
    this.chunks.delete(documentId)
    this.documentNames.delete(documentId)
    this.indexedDocuments.delete(documentId)

    if (removeFromStorage) {
      await this.initialize()
      if (this.db) {
        await this.db.deleteEmbeddings(documentId)
      }
    }
  }

  /**
   * Get all chunks for a document
   */
  getDocumentChunks(documentId: string): TextChunk[] {
    return this.chunks.get(documentId) ?? []
  }

  /**
   * Get all chunks across all documents
   */
  getAllChunks(): TextChunk[] {
    const allChunks: TextChunk[] = []
    for (const chunks of this.chunks.values()) {
      allChunks.push(...chunks)
    }
    return allChunks
  }

  /**
   * Search across all documents
   */
  async search(
    query: string,
    documentIds?: string[],
    topK: number = 5,
    minSimilarity: number = 0.3
  ): Promise<{ results: SimilarityResult[]; citations: Citation[] }> {
    let chunks: TextChunk[]

    if (documentIds && documentIds.length > 0) {
      chunks = []
      for (const docId of documentIds) {
        const docChunks = this.chunks.get(docId)
        if (docChunks) {
          chunks.push(...docChunks)
        }
      }
    } else {
      chunks = this.getAllChunks()
    }

    const results = await searchSimilarChunks(query, chunks, topK, minSimilarity)

    // Convert to citations
    const citations = results.map((result) => ({
      documentId: result.chunk.documentId,
      documentName: this.documentNames.get(result.chunk.documentId) || 'Unknown',
      pageNumber: result.chunk.pageNumber,
      excerpt: result.chunk.content.slice(0, 200),
      startOffset: result.chunk.startOffset,
      endOffset: result.chunk.endOffset,
      confidence: result.similarity,
    }))

    return { results, citations }
  }

  /**
   * Clear all data from memory
   */
  clear(): void {
    this.chunks.clear()
    this.documentNames.clear()
    this.indexedDocuments.clear()
  }

  /**
   * Get document count
   */
  get documentCount(): number {
    return this.chunks.size
  }

  /**
   * Get total chunk count
   */
  get totalChunks(): number {
    let count = 0
    for (const chunks of this.chunks.values()) {
      count += chunks.length
    }
    return count
  }

  /**
   * Get indexed document IDs
   */
  get indexedDocumentIds(): string[] {
    return Array.from(this.indexedDocuments)
  }
}

/**
 * Global vector store instance
 */
export const vectorStore = new VectorStore()

/**
 * Index a document by chunking text and generating embeddings
 * @param documentId - The document ID
 * @param documentName - The document name for citations
 * @param pages - Array of page objects with pageNumber and textContent
 * @param options - Chunking options
 * @param onProgress - Progress callback
 * @returns Array of chunks with embeddings
 */
export async function indexDocument(
  documentId: string,
  documentName: string,
  pages: Array<{ pageNumber: number; textContent: string }>,
  options: {
    chunkSize?: number
    chunkOverlap?: number
    persist?: boolean
  } = {},
  onProgress?: (progress: { stage: string; progress: number; total?: number }) => void
): Promise<TextChunk[]> {
  const { chunkSize = 512, chunkOverlap = 50, persist = true } = options

  onProgress?.({ stage: 'initializing', progress: 0 })

  // Initialize embedding model
  await initializeEmbeddingModel()

  onProgress?.({ stage: 'chunking', progress: 10 })

  // Extract and chunk text from all pages
  const allChunks: TextChunk[] = []
  for (const page of pages) {
    const text = page.textContent || ''
    if (!text.trim()) continue

    const pageChunks = chunkText(
      text,
      documentId,
      page.pageNumber,
      chunkSize,
      chunkOverlap
    )
    allChunks.push(...pageChunks)
  }

  if (allChunks.length === 0) {
    onProgress?.({ stage: 'complete', progress: 100 })
    return []
  }

  onProgress?.({ stage: 'embedding', progress: 20, total: allChunks.length })

  // Generate embeddings in batches
  const batchSize = 8
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize)
    const embeddings = await generateEmbeddings(batch.map((c) => c.content))

    for (let j = 0; j < batch.length; j++) {
      batch[j].embedding = embeddings.embeddings[j]
    }

    const progress = 20 + Math.floor(((i + batch.length) / allChunks.length) * 70)
    onProgress?.({ stage: 'embedding', progress, total: allChunks.length })
  }

  onProgress?.({ stage: 'storing', progress: 90 })

  // Store in vector store
  vectorStore.addDocument(documentId, documentName, allChunks)

  // Persist to IndexedDB if requested
  if (persist) {
    await vectorStore.persistDocument(documentId)
  }

  onProgress?.({ stage: 'complete', progress: 100 })

  return allChunks
}

/**
 * Search for similar chunks across indexed documents
 * @param query - The search query
 * @param options - Search options
 * @returns Search results with citations
 */
export async function searchSimilar(
  query: string,
  options: {
    documentIds?: string[]
    topK?: number
    minSimilarity?: number
  } = {}
): Promise<{ results: SimilarityResult[]; citations: Citation[] }> {
  const { documentIds, topK = 5, minSimilarity = 0.3 } = options
  return vectorStore.search(query, documentIds, topK, minSimilarity)
}

/**
 * Unload embedding model to free memory
 */
export function unloadEmbeddingModel(): void {
  embeddingModelState.model = null
  embeddingModelState.isLoading = false
  embeddingModelState.error = null
}
