/**
 * OpenRouter API Integration
 * Cloud AI provider with support for multiple models
 */

import type {
  ChatOptions,
  ChatCompletionResponse,
  ChatStreamChunk,
  Message,
  AIModelInfo,
} from '@pdflover/shared'
import { generateId } from '@/lib/utils'

/**
 * OpenRouter API configuration
 */
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1'

/**
 * Available models via OpenRouter
 */
export const OPENROUTER_MODELS: AIModelInfo[] = [
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'openrouter',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsFunctionCalling: true,
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.00125,
    isLocal: false,
  },
  {
    id: 'anthropic/claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'openrouter',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsFunctionCalling: true,
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
    isLocal: false,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openrouter',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsVision: true,
    supportsFunctionCalling: true,
    inputCostPer1K: 0.00015,
    outputCostPer1K: 0.0006,
    isLocal: false,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openrouter',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsFunctionCalling: true,
    inputCostPer1K: 0.005,
    outputCostPer1K: 0.015,
    isLocal: false,
  },
  {
    id: 'google/gemini-pro',
    name: 'Gemini Pro',
    provider: 'openrouter',
    contextWindow: 32000,
    maxOutputTokens: 8192,
    supportsVision: false,
    supportsFunctionCalling: true,
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.0005,
    isLocal: false,
  },
  {
    id: 'meta-llama/llama-3-70b-instruct',
    name: 'Llama 3 70B',
    provider: 'openrouter',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctionCalling: false,
    inputCostPer1K: 0.00059,
    outputCostPer1K: 0.00079,
    isLocal: false,
  },
  {
    id: 'mistralai/mixtral-8x7b-instruct',
    name: 'Mixtral 8x7B',
    provider: 'openrouter',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctionCalling: false,
    inputCostPer1K: 0.00024,
    outputCostPer1K: 0.00024,
    isLocal: false,
  },
]

/**
 * OpenRouter request message format
 */
interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * OpenRouter API response format
 */
interface OpenRouterResponse {
  id: string
  model: string
  choices: Array<{
    message: {
      role: 'assistant'
      content: string
    }
    finish_reason: 'stop' | 'length' | 'content_filter'
    index: number
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * OpenRouter streaming chunk format
 */
interface OpenRouterStreamChunk {
  id: string
  model: string
  choices: Array<{
    delta: {
      role?: string
      content?: string
    }
    finish_reason: 'stop' | 'length' | 'content_filter' | null
    index: number
  }>
}

/**
 * Error response from OpenRouter
 */
interface OpenRouterError {
  error: {
    message: string
    type: string
    code: string
  }
}

/**
 * Build system prompt for document Q&A
 */
function buildSystemPrompt(context?: string): string {
  const basePrompt = `You are a helpful AI assistant that answers questions about documents.
When answering:
- Reference specific parts of the provided context using citations
- Be concise and focused on the question
- If you cannot find the answer in the context, say so clearly
- Format your response clearly with proper paragraphs`

  if (context) {
    return `${basePrompt}\n\nDocument Context:\n${context}`
  }

  return basePrompt
}

/**
 * Convert internal messages to OpenRouter format
 */
function convertMessages(
  messages: Message[],
  systemPrompt?: string,
  context?: string
): OpenRouterMessage[] {
  const result: OpenRouterMessage[] = []

  // Add system message
  result.push({
    role: 'system',
    content: systemPrompt || buildSystemPrompt(context),
  })

  // Convert conversation messages
  for (const msg of messages) {
    if (msg.role === 'system') continue
    result.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })
  }

  return result
}

/**
 * Send a chat completion request to OpenRouter
 */
export async function sendChatCompletion(
  messages: Message[],
  apiKey: string,
  options: Partial<ChatOptions> = {}
): Promise<ChatCompletionResponse> {
  const startTime = performance.now()
  const modelId = options.modelId || 'anthropic/claude-3-haiku'

  const requestBody = {
    model: modelId,
    messages: convertMessages(messages, options.systemPrompt),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    top_p: options.topP ?? 1,
    stop: options.stopSequences,
  }

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'PDFLover',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = (await response.json()) as OpenRouterError
    throw new Error(
      errorData.error?.message || `OpenRouter API error: ${response.status}`
    )
  }

  const data = (await response.json()) as OpenRouterResponse
  const processingTime = performance.now() - startTime

  const choice = data.choices[0]
  if (!choice) {
    throw new Error('No response from OpenRouter')
  }

  // Create response message
  const responseMessage: Message = {
    id: generateId(),
    role: 'assistant',
    content: choice.message.content,
    timestamp: new Date(),
    model: data.model,
    processingTime,
    tokenCount: data.usage?.completion_tokens,
  }

  return {
    message: responseMessage,
    model: data.model,
    finishReason: choice.finish_reason === 'content_filter' ? 'content_filter' : choice.finish_reason,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  }
}

/**
 * Stream a chat completion response from OpenRouter
 */
export async function* streamChatCompletion(
  messages: Message[],
  apiKey: string,
  options: Partial<ChatOptions> = {}
): AsyncGenerator<ChatStreamChunk> {
  const modelId = options.modelId || 'anthropic/claude-3-haiku'

  const requestBody = {
    model: modelId,
    messages: convertMessages(messages, options.systemPrompt),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    top_p: options.topP ?? 1,
    stop: options.stopSequences,
    stream: true,
  }

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'PDFLover',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = (await response.json()) as OpenRouterError
    throw new Error(
      errorData.error?.message || `OpenRouter API error: ${response.status}`
    )
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue
        if (!trimmedLine.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmedLine.slice(6)) as OpenRouterStreamChunk
          const choice = json.choices[0]

          if (choice?.delta?.content) {
            const chunk: ChatStreamChunk = {
              id: json.id,
              delta: choice.delta.content,
              isFinished: choice.finish_reason !== null,
              finishReason: choice.finish_reason
                ? choice.finish_reason === 'content_filter'
                  ? 'content_filter'
                  : choice.finish_reason
                : undefined,
            }
            yield chunk
          } else if (choice?.finish_reason) {
            yield {
              id: json.id,
              delta: '',
              isFinished: true,
              finishReason: choice.finish_reason === 'content_filter'
                ? 'content_filter'
                : choice.finish_reason,
            }
          }
        } catch {
          // Skip invalid JSON lines
          continue
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Validate an OpenRouter API key
 */
export async function validateApiKey(apiKey: string): Promise<{
  valid: boolean
  error?: string
}> {
  try {
    const response = await fetch(`${OPENROUTER_API_URL}/auth/key`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (response.ok) {
      return { valid: true }
    }

    const errorData = (await response.json()) as OpenRouterError
    return {
      valid: false,
      error: errorData.error?.message || 'Invalid API key',
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to validate API key',
    }
  }
}

/**
 * Get available models from OpenRouter
 */
export async function fetchAvailableModels(apiKey: string): Promise<AIModelInfo[]> {
  try {
    const response = await fetch(`${OPENROUTER_API_URL}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch models')
    }

    const data = (await response.json()) as {
      data: Array<{
        id: string
        name: string
        context_length: number
        pricing: {
          prompt: string
          completion: string
        }
      }>
    }

    return data.data.map((model) => ({
      id: model.id,
      name: model.name,
      provider: 'openrouter' as const,
      contextWindow: model.context_length,
      maxOutputTokens: Math.min(model.context_length / 4, 8192),
      supportsVision: model.id.includes('vision') || model.id.includes('4o'),
      supportsFunctionCalling: model.id.includes('gpt') || model.id.includes('claude'),
      inputCostPer1K: parseFloat(model.pricing.prompt) * 1000,
      outputCostPer1K: parseFloat(model.pricing.completion) * 1000,
      isLocal: false,
    }))
  } catch {
    // Return default models on error
    return OPENROUTER_MODELS
  }
}

/**
 * Estimate cost for a completion
 */
export function estimateCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  const model = OPENROUTER_MODELS.find((m) => m.id === modelId)
  if (!model) return 0

  const inputCost = (promptTokens / 1000) * (model.inputCostPer1K ?? 0)
  const outputCost = (completionTokens / 1000) * (model.outputCostPer1K ?? 0)

  return inputCost + outputCost
}
