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
 * In-memory vector store for document embeddings
 */
export class VectorStore {
  private chunks: Map<string, TextChunk[]> = new Map()
  private documentNames: Map<string, string> = new Map()

  /**
   * Add chunks for a document
   */
  addDocument(documentId: string, documentName: string, chunks: TextChunk[]): void {
    this.chunks.set(documentId, chunks)
    this.documentNames.set(documentId, documentName)
  }

  /**
   * Remove a document
   */
  removeDocument(documentId: string): void {
    this.chunks.delete(documentId)
    this.documentNames.delete(documentId)
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
   * Clear all data
   */
  clear(): void {
    this.chunks.clear()
    this.documentNames.clear()
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
}

/**
 * Global vector store instance
 */
export const vectorStore = new VectorStore()

/**
 * Unload embedding model to free memory
 */
export function unloadEmbeddingModel(): void {
  embeddingModelState.model = null
  embeddingModelState.isLoading = false
  embeddingModelState.error = null
}
