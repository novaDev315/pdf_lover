/**
 * AI Library
 * Local and cloud AI utilities for PDFLover
 */

// Local LLM (Transformers.js)
export {
  initializeLocalModel,
  generateLocalResponse,
  generateLocalResponseStream,
  checkWebGPUAvailability,
  isModelReady,
  getModelState,
  unloadModel,
  unloadAllModels,
  getMemoryUsage,
  LOCAL_MODELS,
} from './local-llm'
export type {
  LocalModelConfig,
  ModelLoadProgressCallback,
} from './local-llm'

// OpenRouter API
export {
  sendChatCompletion,
  streamChatCompletion,
  validateApiKey,
  fetchAvailableModels,
  estimateCost,
  OPENROUTER_MODELS,
} from './openrouter'

// Embeddings & RAG
export {
  initializeEmbeddingModel,
  isEmbeddingModelReady,
  generateEmbeddings,
  generateSingleEmbedding,
  chunkText,
  cosineSimilarity,
  searchSimilarChunks,
  buildContextFromResults,
  resultsToCitations,
  VectorStore,
  vectorStore,
  unloadEmbeddingModel,
  indexDocument,
  searchSimilar,
} from './embeddings'
export type {
  EmbeddingLoadProgressCallback,
  SimilarityResult,
} from './embeddings'

// RAG Pipeline
export {
  createDocumentIndex,
  queryWithContext,
  generateRAGResponse,
  generateRAGResponseStream,
  buildPromptWithContext,
  isDocumentIndexed,
  getDocumentChunkCount,
  clearDocumentIndex,
  type RAGContext,
  type RAGQueryResult,
  type RAGResponseOptions,
  type IndexingProgress,
  type PDFDocument,
} from './rag'
