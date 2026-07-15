/**
 * Local LLM using Transformers.js
 * Runs entirely in the browser with WebGPU acceleration
 */

import type {
  ChatOptions,
  ChatCompletionResponse,
  ChatStreamChunk,
  Message,
  LocalModelId,
} from '@pdflover/shared'
import { generateId } from '@/lib/utils'

/**
 * Supported local model configurations
 */
export interface LocalModelConfig {
  id: LocalModelId
  name: string
  task: 'text2text-generation' | 'text-generation' | 'question-answering'
  contextWindow: number
  maxOutputTokens: number
  requiresWebGPU: boolean
}

/**
 * Available local models
 */
export const LOCAL_MODELS: LocalModelConfig[] = [
  {
    id: 'Xenova/flan-t5-small',
    name: 'FLAN-T5 Small',
    task: 'text2text-generation',
    contextWindow: 512,
    maxOutputTokens: 256,
    requiresWebGPU: false,
  },
  {
    id: 'Xenova/flan-t5-base',
    name: 'FLAN-T5 Base',
    task: 'text2text-generation',
    contextWindow: 512,
    maxOutputTokens: 256,
    requiresWebGPU: false,
  },
]

/**
 * Model loading state
 */
interface ModelState {
  model: unknown | null
  tokenizer: unknown | null
  isLoading: boolean
  error: string | null
  progress: number
}

/**
 * Global model state (singleton pattern for efficiency)
 */
const modelStates: Map<string, ModelState> = new Map()

/**
 * Check if WebGPU is available
 */
export async function checkWebGPUAvailability(): Promise<{
  available: boolean
  adapter: GPUAdapter | null
  error?: string
}> {
  if (!('gpu' in navigator)) {
    return { available: false, adapter: null, error: 'WebGPU not supported' }
  }

  try {
    const adapter = await (navigator as Navigator & { gpu: GPU }).gpu.requestAdapter()
    if (!adapter) {
      return { available: false, adapter: null, error: 'No GPU adapter found' }
    }
    return { available: true, adapter }
  } catch (error) {
    return {
      available: false,
      adapter: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Progress callback for model loading
 */
export type ModelLoadProgressCallback = (progress: {
  status: string
  file?: string
  progress?: number
  loaded?: number
  total?: number
}) => void

/**
 * Initialize a local model with lazy loading
 */
export async function initializeLocalModel(
  modelId: LocalModelId = 'Xenova/flan-t5-small',
  onProgress?: ModelLoadProgressCallback
): Promise<{ success: boolean; error?: string }> {
  // Check if already loaded
  const existingState = modelStates.get(modelId)
  if (existingState?.model) {
    return { success: true }
  }

  // Initialize state
  const state: ModelState = {
    model: null,
    tokenizer: null,
    isLoading: true,
    error: null,
    progress: 0,
  }
  modelStates.set(modelId, state)

  try {
    onProgress?.({ status: 'loading', progress: 0 })

    // Dynamic import for code splitting
    const { pipeline, env } = await import('@xenova/transformers')

    // Configure Transformers.js
    env.allowLocalModels = false
    env.useBrowserCache = true

    // Find model config
    const modelConfig = LOCAL_MODELS.find((m) => m.id === modelId)
    if (!modelConfig) {
      throw new Error(`Unknown model: ${modelId}`)
    }

    // Check WebGPU if required
    if (modelConfig.requiresWebGPU) {
      const webgpu = await checkWebGPUAvailability()
      if (!webgpu.available) {
        throw new Error(`WebGPU required but not available: ${webgpu.error}`)
      }
    }

    // Load the model pipeline
    const pipe = await pipeline(modelConfig.task, modelId, {
      progress_callback: (progressData: { status: string; file?: string; progress?: number }) => {
        state.progress = progressData.progress ?? 0
        onProgress?.(progressData)
      },
    })

    state.model = pipe
    state.isLoading = false
    state.progress = 100

    onProgress?.({ status: 'ready', progress: 100 })

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load model'
    state.error = errorMessage
    state.isLoading = false
    onProgress?.({ status: 'error' })
    return { success: false, error: errorMessage }
  }
}

/**
 * Get model loading state
 */
export function getModelState(modelId: LocalModelId): ModelState | undefined {
  return modelStates.get(modelId)
}

/**
 * Check if a model is loaded and ready
 */
export function isModelReady(modelId: LocalModelId): boolean {
  const state = modelStates.get(modelId)
  return state?.model !== null && !state?.isLoading
}

/**
 * Build a prompt from conversation messages
 */
function buildPrompt(
  messages: Message[],
  systemPrompt?: string,
  context?: string
): string {
  const parts: string[] = []

  // Add system prompt
  if (systemPrompt) {
    parts.push(`System: ${systemPrompt}`)
  }

  // Add context from documents
  if (context) {
    parts.push(`Context:\n${context}`)
  }

  // Add conversation history (limit to recent messages)
  const recentMessages = messages.slice(-6) // Keep last 6 messages
  for (const msg of recentMessages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant'
    parts.push(`${role}: ${msg.content}`)
  }

  // Add prompt for assistant response
  parts.push('Assistant:')

  return parts.join('\n\n')
}

/**
 * Default system prompt for document Q&A
 */
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant that answers questions about documents.
When answering, reference specific parts of the provided context.
If you cannot find the answer in the context, say so clearly.
Keep your answers concise and focused on the question.`

/**
 * Generate a text response using a local model
 */
export async function generateLocalResponse(
  messages: Message[],
  options: Partial<ChatOptions> = {}
): Promise<ChatCompletionResponse> {
  const modelId = (options.modelId as LocalModelId) || 'Xenova/flan-t5-small'
  const startTime = performance.now()

  // Ensure model is loaded
  const state = modelStates.get(modelId)
  if (!state?.model) {
    const result = await initializeLocalModel(modelId)
    if (!result.success) {
      throw new Error(result.error || 'Failed to initialize model')
    }
  }

  const pipe = modelStates.get(modelId)?.model as (
    input: string,
    options: Record<string, unknown>
  ) => Promise<Array<{ generated_text: string }>>

  if (!pipe) {
    throw new Error('Model not available')
  }

  // Build prompt
  const prompt = buildPrompt(
    messages,
    options.systemPrompt || DEFAULT_SYSTEM_PROMPT
  )

  // Generate response
  const result = await pipe(prompt, {
    max_new_tokens: options.maxTokens ?? 256,
    temperature: options.temperature ?? 0.7,
    top_p: options.topP ?? 0.95,
    do_sample: true,
  })

  const generatedText = result[0]?.generated_text || ''
  const processingTime = performance.now() - startTime

  // Create response message
  const responseMessage: Message = {
    id: generateId(),
    role: 'assistant',
    content: generatedText.trim(),
    timestamp: new Date(),
    model: modelId,
    processingTime,
  }

  return {
    message: responseMessage,
    model: modelId,
    finishReason: 'stop',
  }
}

/**
 * Generator function for streaming responses
 */
export async function* generateLocalResponseStream(
  messages: Message[],
  options: Partial<ChatOptions> = {}
): AsyncGenerator<ChatStreamChunk> {
  const modelId = (options.modelId as LocalModelId) || 'Xenova/flan-t5-small'

  // Ensure model is loaded
  const state = modelStates.get(modelId)
  if (!state?.model) {
    const result = await initializeLocalModel(modelId)
    if (!result.success) {
      throw new Error(result.error || 'Failed to initialize model')
    }
  }

  // The current Transformers.js pipelines return a completed generation. Emit
  // one truthful terminal chunk without artificial token timing.
  const response = await generateLocalResponse(messages, options)
  yield {
    id: generateId(),
    delta: response.message.content,
    isFinished: true,
    finishReason: 'stop',
  }
}

/**
 * Unload a model to free memory
 */
export function unloadModel(modelId: LocalModelId): void {
  const state = modelStates.get(modelId)
  if (state) {
    state.model = null
    state.tokenizer = null
    state.isLoading = false
    state.progress = 0
    modelStates.delete(modelId)
  }
}

/**
 * Unload all models
 */
export function unloadAllModels(): void {
  for (const modelId of modelStates.keys()) {
    unloadModel(modelId as LocalModelId)
  }
}

/**
 * Get memory usage estimate for loaded models
 */
export function getMemoryUsage(): { loaded: string[]; estimatedMB: number } {
  const loaded: string[] = []
  let estimatedMB = 0

  for (const [modelId, state] of modelStates) {
    if (state.model) {
      loaded.push(modelId)
      // Rough estimates based on model sizes
      if (modelId.includes('small')) {
        estimatedMB += 100
      } else if (modelId.includes('base')) {
        estimatedMB += 250
      } else {
        estimatedMB += 500
      }
    }
  }

  return { loaded, estimatedMB }
}
