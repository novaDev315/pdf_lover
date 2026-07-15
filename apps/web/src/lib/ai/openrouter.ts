/**
 * OpenRouter integration through the PDFLover backend. The browser never
 * receives or stores the provider credential.
 */

import type {
  ChatOptions,
  ChatCompletionResponse,
  ChatStreamChunk,
  Message,
} from '@pdflover/shared'
import { generateId } from '@/lib/utils'

/**
 * OpenRouter API configuration
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const CHAT_API_URL = `${API_BASE_URL}/api/v1/ai/chat`

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

interface ApiProxyError {
  error?: {
    message?: string
  }
}

async function responseError(response: Response): Promise<string> {
  try {
    const data = await response.json() as OpenRouterError | ApiProxyError
    return data.error?.message || `AI request failed with status ${response.status}`
  } catch {
    return `AI request failed with status ${response.status}`
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
  options: Partial<ChatOptions> = {}
): Promise<ChatCompletionResponse> {
  const startTime = performance.now()
  const modelId = options.modelId || 'openrouter/auto'

  const requestBody = {
    model: modelId,
    messages: convertMessages(messages, options.systemPrompt),
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 2048,
    stream: false,
  }

  const response = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new Error(await responseError(response))
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
  options: Partial<ChatOptions> = {}
): AsyncGenerator<ChatStreamChunk> {
  const modelId = options.modelId || 'openrouter/auto'

  const requestBody = {
    model: modelId,
    messages: convertMessages(messages, options.systemPrompt),
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 2048,
    stream: true,
  }

  const response = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new Error(await responseError(response))
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
