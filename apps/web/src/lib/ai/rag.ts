/**
 * RAG (Retrieval Augmented Generation) Pipeline
 * Provides document indexing, context retrieval, and response generation
 */

import type {
  TextChunk,
  Citation,
  Message,
  AIProvider,
  ChatCompletionResponse,
} from '@pdflover/shared'

import {
  vectorStore,
  indexDocument as indexDocumentEmbeddings,
  searchSimilar,
  buildContextFromResults,
  type SimilarityResult,
} from './embeddings'

import { generateLocalResponse, generateLocalResponseStream } from './local-llm'
import { sendChatCompletion, streamChatCompletion } from './openrouter'

/**
 * Progress information for document indexing
 */
export interface IndexingProgress {
  /** Current stage of indexing */
  stage: 'initializing' | 'chunking' | 'embedding' | 'storing' | 'complete' | 'error'
  /** Progress percentage (0-100) */
  progress: number
  /** Total number of chunks (when available) */
  totalChunks?: number
  /** Number of processed chunks */
  processedChunks?: number
  /** Error message if stage is 'error' */
  error?: string
}

/**
 * Context retrieved for a query
 */
export interface RAGContext {
  /** Retrieved text chunks */
  chunks: TextChunk[]
  /** Similarity results with scores */
  results: SimilarityResult[]
  /** Citations for the response */
  citations: Citation[]
  /** Formatted context string */
  contextText: string
  /** Total tokens in context (estimate) */
  estimatedTokens: number
}

/**
 * Result of a RAG query
 */
export interface RAGQueryResult {
  /** Retrieved context */
  context: RAGContext
  /** Whether context was found */
  hasContext: boolean
  /** Query processing time in ms */
  queryTime: number
}

/**
 * Options for RAG response generation
 */
export interface RAGResponseOptions {
  /** AI provider to use */
  provider: AIProvider
  /** Model ID */
  modelId: string
  /** API key for cloud providers */
  /** Temperature for generation */
  temperature?: number
  /** Maximum tokens to generate */
  maxTokens?: number
  /** Whether to stream the response */
  stream?: boolean
  /** Custom system prompt (context will be prepended) */
  customSystemPrompt?: string
}

/**
 * PDF document structure for indexing
 */
export interface PDFDocument {
  id: string
  name: string
  pages: Array<{
    pageNumber: number
    textContent?: string
  }>
}

/**
 * Create a document index for RAG
 * Extracts text from PDF and creates embeddings
 *
 * @param documentId - Unique document identifier
 * @param pdfDocument - PDF document with pages and text content
 * @param options - Indexing options
 * @param onProgress - Progress callback
 * @returns Array of indexed chunks
 */
export async function createDocumentIndex(
  documentId: string,
  pdfDocument: PDFDocument,
  options: {
    chunkSize?: number
    chunkOverlap?: number
    persist?: boolean
    forceReindex?: boolean
  } = {},
  onProgress?: (progress: IndexingProgress) => void
): Promise<TextChunk[]> {
  const { forceReindex = false, ...indexOptions } = options

  try {
    // Check if already indexed (unless force reindex)
    if (!forceReindex && vectorStore.isDocumentIndexed(documentId)) {
      onProgress?.({ stage: 'complete', progress: 100 })
      return vectorStore.getDocumentChunks(documentId)
    }

    // Remove existing index if force reindex
    if (forceReindex) {
      await vectorStore.removeDocument(documentId, true)
    }

    // Prepare pages for indexing
    const pages = pdfDocument.pages
      .filter((page) => page.textContent && page.textContent.trim())
      .map((page) => ({
        pageNumber: page.pageNumber,
        textContent: page.textContent || '',
      }))

    if (pages.length === 0) {
      onProgress?.({
        stage: 'error',
        progress: 0,
        error: 'No text content found in document',
      })
      return []
    }

    // Index the document
    const chunks = await indexDocumentEmbeddings(
      documentId,
      pdfDocument.name,
      pages,
      indexOptions,
      (progress) => {
        onProgress?.({
          stage: progress.stage as IndexingProgress['stage'],
          progress: progress.progress,
          totalChunks: progress.total,
        })
      }
    )

    return chunks
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to index document'
    onProgress?.({
      stage: 'error',
      progress: 0,
      error: errorMessage,
    })
    throw error
  }
}

/**
 * Query documents and retrieve relevant context
 *
 * @param query - User's question or query
 * @param documentId - Document ID to search (or undefined for all)
 * @param options - Query options
 * @returns Query result with context
 */
export async function queryWithContext(
  query: string,
  documentId?: string,
  options: {
    topK?: number
    minSimilarity?: number
    maxContextLength?: number
  } = {}
): Promise<RAGQueryResult> {
  const startTime = performance.now()
  const { topK = 5, minSimilarity = 0.3, maxContextLength = 4000 } = options

  try {
    // Search for similar chunks
    const { results, citations } = await searchSimilar(query, {
      documentIds: documentId ? [documentId] : undefined,
      topK,
      minSimilarity,
    })

    // Build context from results
    const contextText = buildContextFromResults(results, maxContextLength)

    // Estimate tokens (rough approximation: 4 chars per token)
    const estimatedTokens = Math.ceil(contextText.length / 4)

    const queryTime = performance.now() - startTime

    return {
      context: {
        chunks: results.map((r) => r.chunk),
        results,
        citations,
        contextText,
        estimatedTokens,
      },
      hasContext: results.length > 0,
      queryTime,
    }
  } catch (error) {
    console.error('Failed to query context:', error)
    return {
      context: {
        chunks: [],
        results: [],
        citations: [],
        contextText: '',
        estimatedTokens: 0,
      },
      hasContext: false,
      queryTime: performance.now() - startTime,
    }
  }
}

/**
 * Build a prompt with retrieved context
 *
 * @param query - User's question
 * @param relevantChunks - Retrieved context chunks
 * @param options - Prompt building options
 * @returns Formatted prompt string
 */
export function buildPromptWithContext(
  query: string,
  relevantChunks: SimilarityResult[],
  options: {
    maxContextLength?: number
    includePageNumbers?: boolean
    customInstructions?: string
  } = {}
): string {
  const {
    maxContextLength = 4000,
    includePageNumbers = true,
    customInstructions,
  } = options

  const parts: string[] = []

  // Custom instructions
  if (customInstructions) {
    parts.push(customInstructions)
  }

  // Context section
  if (relevantChunks.length > 0) {
    parts.push('## Document Context\n')
    parts.push('Use the following excerpts from the document to answer the question.')
    parts.push('Always cite the page number when referencing specific information.\n')

    let currentLength = 0
    for (const result of relevantChunks) {
      const pageInfo = includePageNumbers
        ? `[Page ${result.chunk.pageNumber}] `
        : ''
      const entry = `${pageInfo}${result.chunk.content}\n`

      if (currentLength + entry.length > maxContextLength) {
        break
      }

      parts.push(entry)
      currentLength += entry.length
    }
  } else {
    parts.push('No relevant context was found in the document for this question.')
    parts.push('Please answer based on your general knowledge, and note that the information may not be from the document.')
  }

  // Question section
  parts.push('\n## Question\n')
  parts.push(query)

  // Instructions
  parts.push('\n## Instructions\n')
  parts.push('- Answer the question based on the provided context')
  parts.push('- Include page number citations when referencing specific information')
  parts.push('- If the context does not contain enough information, say so clearly')
  parts.push('- Be concise and accurate')

  return parts.join('\n')
}

/**
 * Default system prompt for RAG responses
 */
const DEFAULT_RAG_SYSTEM_PROMPT = `You are a helpful AI assistant that answers questions about documents.
When answering:
- Reference specific parts of the provided context
- Include page numbers as citations when quoting or referencing specific information
- If you cannot find the answer in the context, say so clearly
- Keep your answers concise and focused on the question
- Format citations as [Page X] inline with the text`

/**
 * Generate a RAG response using the AI provider
 *
 * @param query - User's question
 * @param context - Retrieved context
 * @param options - Generation options
 * @returns Chat completion response
 */
export async function generateRAGResponse(
  query: string,
  context: RAGContext,
  options: RAGResponseOptions
): Promise<ChatCompletionResponse> {
  const {
    provider,
    modelId,
    temperature = 0.7,
    maxTokens = 1024,
    customSystemPrompt,
  } = options

  // Build the system prompt with context
  const systemPrompt = buildSystemPromptWithContext(
    context,
    customSystemPrompt || DEFAULT_RAG_SYSTEM_PROMPT
  )

  // Create messages array
  const messages: Message[] = [
    {
      id: 'user-query',
      role: 'user',
      content: query,
      timestamp: new Date(),
    },
  ]

  // Generate response based on provider
  if (provider === 'local') {
    const response = await generateLocalResponse(messages, {
      modelId,
      systemPrompt,
      temperature,
      maxTokens,
    })

    // Attach citations to response
    response.message.citations = context.citations
    response.retrievedChunks = context.chunks

    return response
  } else {
    // Cloud provider (OpenRouter through the backend proxy)
    const response = await sendChatCompletion(messages, {
      modelId,
      systemPrompt,
      temperature,
      maxTokens,
    })

    // Attach citations to response
    response.message.citations = context.citations
    response.retrievedChunks = context.chunks

    return response
  }
}

/**
 * Generate a streaming RAG response
 *
 * @param query - User's question
 * @param context - Retrieved context
 * @param options - Generation options
 * @yields Chat stream chunks
 */
export async function* generateRAGResponseStream(
  query: string,
  context: RAGContext,
  options: RAGResponseOptions
): AsyncGenerator<import('@pdflover/shared').ChatStreamChunk> {
  const {
    provider,
    modelId,
    temperature = 0.7,
    maxTokens = 1024,
    customSystemPrompt,
  } = options

  // Build the system prompt with context
  const systemPrompt = buildSystemPromptWithContext(
    context,
    customSystemPrompt || DEFAULT_RAG_SYSTEM_PROMPT
  )

  // Create messages array
  const messages: Message[] = [
    {
      id: 'user-query',
      role: 'user',
      content: query,
      timestamp: new Date(),
    },
  ]

  // Generate response based on provider
  if (provider === 'local') {
    yield* generateLocalResponseStream(messages, {
      modelId,
      systemPrompt,
      temperature,
      maxTokens,
    })
  } else {
    // Cloud provider (OpenRouter through the backend proxy)
    yield* streamChatCompletion(messages, {
      modelId,
      systemPrompt,
      temperature,
      maxTokens,
    })
  }
}

/**
 * Build system prompt with context
 */
function buildSystemPromptWithContext(
  context: RAGContext,
  basePrompt: string
): string {
  if (!context.contextText || context.chunks.length === 0) {
    return `${basePrompt}\n\nNote: No relevant context was found in the document for this question.`
  }

  return `${basePrompt}

## Retrieved Context from Document

${context.contextText}

## Citation Guidelines
When referencing information from the context above, include the page number in your response like this: [Page X].`
}

/**
 * Check if a document has been indexed
 */
export function isDocumentIndexed(documentId: string): boolean {
  return vectorStore.isDocumentIndexed(documentId)
}

/**
 * Get chunk count for a document
 */
export function getDocumentChunkCount(documentId: string): number {
  return vectorStore.getDocumentChunks(documentId).length
}

/**
 * Clear document index
 */
export async function clearDocumentIndex(
  documentId: string,
  removeFromStorage = true
): Promise<void> {
  await vectorStore.removeDocument(documentId, removeFromStorage)
}
