/**
 * Chat and AI-related type definitions for PDFLover
 */

/**
 * Supported AI providers
 */
export type AIProvider =
  | 'local'        // Transformers.js with WebGPU
  | 'openrouter'   // OpenRouter API proxy
  | 'openai'       // Direct OpenAI API
  | 'anthropic';   // Direct Anthropic API

/**
 * Available local AI models for Transformers.js
 */
export type LocalModelId =
  | 'Xenova/all-MiniLM-L6-v2'           // Embeddings
  | 'Xenova/distilbert-base-uncased'    // QA
  | 'Xenova/flan-t5-small'              // Text generation
  | 'Xenova/flan-t5-base';              // Text generation (larger)

/**
 * Message role in a conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Citation reference to a specific location in a PDF
 */
export interface Citation {
  /** ID of the referenced document */
  documentId: string;
  /** Document filename for display */
  documentName: string;
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Cited text excerpt */
  excerpt: string;
  /** Start position in the page text */
  startOffset?: number;
  /** End position in the page text */
  endOffset?: number;
  /** Confidence score (0-1) for AI-generated citations */
  confidence?: number;
}

/**
 * Attachment in a chat message
 */
export interface MessageAttachment {
  /** Attachment type */
  type: 'pdf' | 'image' | 'text';
  /** Referenced document ID */
  documentId?: string;
  /** Filename */
  filename: string;
  /** File size in bytes */
  fileSize: number;
  /** Preview thumbnail (data URL) */
  thumbnail?: string;
}

/**
 * A single message in a conversation
 */
export interface Message {
  /** Unique message ID */
  id: string;
  /** Message role */
  role: MessageRole;
  /** Message content (text) */
  content: string;
  /** Citations referenced in the message */
  citations?: Citation[];
  /** Attached files */
  attachments?: MessageAttachment[];
  /** Message timestamp */
  timestamp: Date;
  /** Whether the message is still being generated */
  isStreaming?: boolean;
  /** Token count for the message */
  tokenCount?: number;
  /** Model used to generate the response */
  model?: string;
  /** Processing duration in milliseconds */
  processingTime?: number;
}

/**
 * Conversation context - documents associated with the chat
 */
export interface ConversationContext {
  /** Document IDs in the conversation context */
  documentIds: string[];
  /** Extracted text chunks with embeddings */
  chunks?: TextChunk[];
  /** Whether the context is fully loaded */
  isLoaded: boolean;
}

/**
 * A text chunk for RAG (Retrieval Augmented Generation)
 */
export interface TextChunk {
  /** Unique chunk ID */
  id: string;
  /** Source document ID */
  documentId: string;
  /** Page number */
  pageNumber: number;
  /** Chunk text content */
  content: string;
  /** Vector embedding */
  embedding?: number[];
  /** Start position in page */
  startOffset: number;
  /** End position in page */
  endOffset: number;
}

/**
 * A chat conversation
 */
export interface Conversation {
  /** Unique conversation ID */
  id: string;
  /** Conversation title */
  title: string;
  /** Messages in the conversation */
  messages: Message[];
  /** Conversation context (documents) */
  context: ConversationContext;
  /** AI provider used */
  provider: AIProvider;
  /** Model identifier */
  modelId: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Whether this is the active conversation */
  isActive?: boolean;
  /** Total token count for the conversation */
  totalTokens?: number;
}

/**
 * Chat options for sending a message
 */
export interface ChatOptions {
  /** AI provider to use */
  provider: AIProvider;
  /** Model identifier */
  modelId: string;
  /** System prompt */
  systemPrompt?: string;
  /** Temperature (0-2, default: 0.7) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Top P sampling */
  topP?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Whether to stream the response */
  stream?: boolean;
  /** Number of context chunks to include (for RAG) */
  contextChunks?: number;
  /** Minimum similarity score for context retrieval */
  minSimilarity?: number;
}

/**
 * RAG (Retrieval Augmented Generation) options
 */
export interface RAGOptions {
  /** Chunk size in characters */
  chunkSize?: number;
  /** Overlap between chunks in characters */
  chunkOverlap?: number;
  /** Number of chunks to retrieve */
  topK?: number;
  /** Minimum similarity threshold */
  minSimilarity?: number;
  /** Whether to rerank results */
  rerank?: boolean;
}

/**
 * AI model information
 */
export interface AIModelInfo {
  /** Model identifier */
  id: string;
  /** Display name */
  name: string;
  /** Model provider */
  provider: AIProvider;
  /** Context window size in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Whether the model supports vision/images */
  supportsVision: boolean;
  /** Whether the model supports function calling */
  supportsFunctionCalling: boolean;
  /** Cost per 1K input tokens (USD) */
  inputCostPer1K?: number;
  /** Cost per 1K output tokens (USD) */
  outputCostPer1K?: number;
  /** Whether this is a local model */
  isLocal: boolean;
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  /** Response message */
  message: Message;
  /** Token usage */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Model used */
  model: string;
  /** Finish reason */
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  /** Retrieved context chunks (for RAG) */
  retrievedChunks?: TextChunk[];
}

/**
 * Streaming chunk for chat responses
 */
export interface ChatStreamChunk {
  /** Chunk ID */
  id: string;
  /** Delta content */
  delta: string;
  /** Whether this is the final chunk */
  isFinished: boolean;
  /** Finish reason (on final chunk) */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error';
}

/**
 * Embedding request options
 */
export interface EmbeddingOptions {
  /** Model to use for embeddings */
  modelId?: LocalModelId;
  /** Batch size for processing */
  batchSize?: number;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  /** Vector embeddings */
  embeddings: number[][];
  /** Model used */
  model: string;
  /** Total tokens processed */
  totalTokens: number;
  /** Processing duration in milliseconds */
  duration: number;
}
