import { Readable } from 'node:stream';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiConfig } from '../config.js';
import { ApiError } from '../errors.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  model?: unknown;
  messages?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
  stream?: unknown;
}

function parseBody(value: unknown): {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream: boolean;
} {
  if (!value || typeof value !== 'object') {
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Chat request body must be an object',
    });
  }
  const body = value as ChatRequestBody;
  if (typeof body.model !== 'string' || !/^[a-zA-Z0-9._:/-]{1,160}$/.test(body.model)) {
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'A valid OpenRouter model identifier is required',
    });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 100) {
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'messages must contain between 1 and 100 entries',
    });
  }

  let contentLength = 0;
  const messages = body.messages.map((candidate): ChatMessage => {
    if (!candidate || typeof candidate !== 'object') {
      throw new ApiError({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Each chat message must be an object',
      });
    }
    const message = candidate as Record<string, unknown>;
    if (
      message.role !== 'system' &&
      message.role !== 'user' &&
      message.role !== 'assistant'
    ) {
      throw new ApiError({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Chat message role is invalid',
      });
    }
    if (typeof message.content !== 'string' || message.content.length === 0) {
      throw new ApiError({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Chat message content must be a non-empty string',
      });
    }
    contentLength += message.content.length;
    return { role: message.role, content: message.content };
  });
  if (contentLength > 200_000) {
    throw new ApiError({
      statusCode: 413,
      code: 'FILE_TOO_LARGE',
      message: 'Chat request content exceeds 200000 characters',
    });
  }

  const temperature = body.temperature;
  if (
    temperature !== undefined &&
    (typeof temperature !== 'number' || temperature < 0 || temperature > 2)
  ) {
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'temperature must be between 0 and 2',
    });
  }
  const maxTokens = body.maxTokens;
  if (
    maxTokens !== undefined &&
    (typeof maxTokens !== 'number' ||
      !Number.isSafeInteger(maxTokens) ||
      maxTokens < 1 ||
      maxTokens > 32_768)
  ) {
    throw new ApiError({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'maxTokens must be an integer between 1 and 32768',
    });
  }

  return {
    model: body.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: body.stream !== false,
  };
}

function safeUpstreamMessage(status: number): string {
  if (status === 401 || status === 403) return 'OpenRouter credentials were rejected';
  if (status === 429) return 'OpenRouter rate limit was reached';
  return `OpenRouter request failed with status ${status}`;
}

export async function forwardOpenRouterChat(
  request: FastifyRequest,
  reply: FastifyReply,
  config: ApiConfig,
): Promise<void> {
  if (!config.openRouterApiKey) {
    throw new ApiError({
      statusCode: 503,
      code: 'ENGINE_UNAVAILABLE',
      message: 'OpenRouter is not configured on the server',
      retryable: true,
    });
  }
  const body = parseBody(request.body);

  let upstream: Response;
  try {
    upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://web.pdflover.lab.novadev.tech',
        'X-Title': 'PDFLover',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.openRouterTimeoutMs),
    });
  } catch (error) {
    throw new ApiError({
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: error instanceof Error && error.name === 'TimeoutError'
        ? 'OpenRouter request timed out'
        : 'OpenRouter could not be reached',
      retryable: true,
    });
  }

  if (!upstream.ok) {
    throw new ApiError({
      statusCode: upstream.status === 429 ? 429 : 502,
      code: upstream.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_ERROR',
      message: safeUpstreamMessage(upstream.status),
      retryable: upstream.status === 429 || upstream.status >= 500,
    });
  }

  if (!body.stream) {
    reply.type('application/json').send(await upstream.text());
    return;
  }
  if (!upstream.body) {
    throw new ApiError({
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: 'OpenRouter returned an empty stream',
      retryable: true,
    });
  }

  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  await new Promise<void>((resolve, reject) => {
    const stream = Readable.fromWeb(upstream.body as never);
    stream.on('error', reject);
    reply.raw.on('close', resolve);
    stream.pipe(reply.raw).on('finish', resolve).on('error', reject);
  });
}
