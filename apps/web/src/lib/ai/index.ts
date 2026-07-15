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

// Document Classification
export {
  classifyDocumentEnhanced,
  classifyWithPatterns,
  classifyWithML,
  quickClassify,
  batchClassifyEnhanced,
  generateClassificationSummary,
  initializeMLClassifier,
  isMLClassificationAvailable,
  getMLModelState,
  unloadMLClassifier,
  getDocumentTypes,
  getDocumentTypeLabel,
  getDocumentTypeDescription,
  detectKeywords,
  extractDocumentFeatures,
} from './classifier'
export type {
  EnhancedClassification,
  MLClassificationResult,
  CombinedClassifyOptions,
  ClassificationSummary,
  DocumentType,
  DocumentFeatures,
  KeywordMatch,
  DocumentMetadata,
  ConfidenceLevel,
  Classification,
} from './classifier'
