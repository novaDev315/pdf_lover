/**
 * Message Bubble Component
 * Displays individual chat messages with proper formatting
 */

import * as React from 'react'
import {
  User,
  Bot,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Loader2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn, formatDuration } from '@/lib/utils'
import { CitationList } from './CitationLink'
import type { Message, Citation } from '@pdflover/shared'

export interface MessageBubbleProps {
  /** Message data */
  message: Message
  /** Whether the message is currently streaming */
  isStreaming?: boolean
  /** Streaming content (partial message during generation) */
  streamingContent?: string
  /** Callback to regenerate the message */
  onRegenerate?: (messageId: string) => void
  /** Callback when citation is clicked */
  onCitationNavigate?: (citation: Citation) => void
  /** Whether regeneration is available */
  canRegenerate?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Format timestamp to readable time
 */
function formatTimestamp(date: Date): string {
  const now = new Date()
  const messageDate = new Date(date)
  const isToday = messageDate.toDateString() === now.toDateString()

  if (isToday) {
    return messageDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return messageDate.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Parse and format message content with code blocks
 */
function formatMessageContent(content: string): React.ReactNode {
  // Split content by code blocks
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {formatInlineContent(content.slice(lastIndex, match.index))}
        </span>
      )
    }

    // Add code block
    const language = match[1] || 'text'
    const code = match[2].trim()
    parts.push(
      <CodeBlock key={`code-${match.index}`} language={language} code={code} />
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(
      <span key={`text-${lastIndex}`}>
        {formatInlineContent(content.slice(lastIndex))}
      </span>
    )
  }

  return parts.length > 0 ? parts : formatInlineContent(content)
}

/**
 * Format inline content (bold, italic, inline code)
 */
function formatInlineContent(text: string): React.ReactNode {
  // Handle inline code
  const inlineCodeRegex = /`([^`]+)`/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = inlineCodeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <code
        key={`inline-${match.index}`}
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
      >
        {match[1]}
      </code>
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : text
}

/**
 * Code block component with copy functionality
 */
function CodeBlock({
  language,
  code,
}: {
  language: string
  code: string
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="group relative my-2 rounded-lg bg-muted">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {language}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="text-sm">{code}</code>
      </pre>
    </div>
  )
}

/**
 * MessageBubble component displays a single chat message.
 * Supports different styling for user vs assistant messages,
 * code block formatting, and citations.
 *
 * @example
 * ```tsx
 * <MessageBubble
 *   message={{
 *     id: '1',
 *     role: 'assistant',
 *     content: 'Based on the document, the revenue increased...',
 *     timestamp: new Date(),
 *     citations: [{ documentId: 'doc1', pageNumber: 5, ... }],
 *   }}
 *   onRegenerate={(id) => regenerateMessage(id)}
 *   onCitationNavigate={(citation) => goToPage(citation.pageNumber)}
 * />
 * ```
 */
export function MessageBubble({
  message,
  isStreaming = false,
  streamingContent,
  onRegenerate,
  onCitationNavigate,
  canRegenerate = true,
  className,
}: MessageBubbleProps) {
  const [copied, setCopied] = React.useState(false)
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  const displayContent = isStreaming ? streamingContent : message.content

  const handleCopyMessage = React.useCallback(async () => {
    if (!displayContent) return
    await navigator.clipboard.writeText(displayContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [displayContent])

  const handleRegenerate = React.useCallback(() => {
    onRegenerate?.(message.id)
  }, [message.id, onRegenerate])

  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message content */}
      <div
        className={cn(
          'flex max-w-[80%] flex-col gap-1',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* Message bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted rounded-tl-sm'
          )}
        >
          <div className="whitespace-pre-wrap break-words text-sm">
            {displayContent ? formatMessageContent(displayContent) : null}
            {isStreaming && (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current" />
            )}
          </div>
        </div>

        {/* Citations */}
        {!isStreaming && isAssistant && message.citations && message.citations.length > 0 && (
          <div className="mt-2 w-full max-w-md">
            <CitationList
              citations={message.citations}
              onNavigate={onCitationNavigate}
            />
          </div>
        )}

        {/* Message metadata and actions */}
        <div
          className={cn(
            'flex items-center gap-2 text-xs text-muted-foreground',
            isUser ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          {/* Timestamp */}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimestamp(message.timestamp)}
          </span>

          {/* Processing time */}
          {message.processingTime && (
            <span className="text-muted-foreground">
              ({formatDuration(message.processingTime)})
            </span>
          )}

          {/* Model info */}
          {message.model && (
            <span className="hidden sm:inline text-muted-foreground">
              {message.model}
            </span>
          )}

          {/* Actions (visible on hover) */}
          <TooltipProvider>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {/* Copy button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleCopyMessage}
                    disabled={isStreaming}
                    aria-label={copied ? 'Copied' : 'Copy message'}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copied ? 'Copied!' : 'Copy message'}</p>
                </TooltipContent>
              </Tooltip>

              {/* Regenerate button (assistant messages only) */}
              {isAssistant && canRegenerate && !isStreaming && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={handleRegenerate}
                      aria-label="Regenerate response"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Regenerate response</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}

/**
 * Streaming message with an active cursor
 */
export function StreamingMessage({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div className={cn('group flex gap-3 px-4 py-3', className)}>
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Bot className="h-4 w-4" />
      </div>

      {/* Message content */}
      <div className="flex max-w-[80%] flex-col gap-1">
        <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2">
          <div className="whitespace-pre-wrap break-words text-sm">
            {content ? formatMessageContent(content) : null}
            <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-foreground" />
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Generating...</span>
        </div>
      </div>
    </div>
  )
}
