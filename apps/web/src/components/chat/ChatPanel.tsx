/**
 * Chat Panel Component
 * Main chat interface with message list, input, and AI controls
 * Includes RAG integration for document-aware conversations
 */

import * as React from 'react'
import {
  X,
  Trash2,
  Download,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Cloud,
  MessageSquare,
  Bot,
  Loader2,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store/chat-store'
import { useSettingsStore } from '@/store/settings-store'

import { MessageBubble, StreamingMessage } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { DocumentType } from './SuggestedQuestions'
import type { Citation, AIProvider } from '@pdflover/shared'
import type { IndexingProgress } from '@/lib/ai/rag'

export interface ChatPanelProps {
  /** Whether the panel is open */
  isOpen?: boolean
  /** Callback to toggle panel visibility */
  onToggle?: () => void
  /** Callback when user sends a message */
  onSendMessage?: (message: string) => void
  /** Callback to regenerate a message */
  onRegenerate?: (messageId: string) => void
  /** Callback when citation is clicked */
  onCitationNavigate?: (citation: Citation) => void
  /** Document type for suggestions */
  documentType?: DocumentType
  /** PDF document ID for context */
  documentId?: string
  /** Whether the panel is collapsible */
  collapsible?: boolean
  /** Panel position */
  position?: 'left' | 'right'
  /** Panel width when open */
  width?: number | string
  /** Additional CSS classes */
  className?: string
  /** RAG indexing state */
  indexingProgress?: IndexingProgress | null
  /** Whether document is indexed */
  isDocumentIndexed?: boolean
  /** Number of indexed chunks */
  indexedChunkCount?: number
  /** Callback to re-index document */
  onReindex?: () => void
  /** Whether the configured backend can serve cloud AI requests. */
  cloudProviderAvailable?: boolean
}

/**
 * ChatPanel is the main chat interface component.
 * Features a collapsible side panel with message history,
 * AI provider toggle, and conversation controls.
 *
 * @example
 * ```tsx
 * <ChatPanel
 *   isOpen={chatOpen}
 *   onToggle={() => setChatOpen(!chatOpen)}
 *   onSendMessage={handleSendMessage}
 *   documentType="financial"
 * />
 * ```
 */
export function ChatPanel({
  isOpen = true,
  onToggle,
  onSendMessage,
  onRegenerate,
  onCitationNavigate,
  documentType = 'general',
  documentId,
  collapsible = true,
  position = 'right',
  width = 400,
  className,
  indexingProgress,
  isDocumentIndexed = false,
  indexedChunkCount = 0,
  onReindex,
  cloudProviderAvailable = false,
}: ChatPanelProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const messagesContainerRef = React.useRef<HTMLDivElement>(null)

  // Chat store state
  const {
    messages,
    currentConversation,
    isGenerating,
    streamingContent,
    error,
    startConversation,
    clearConversation,
    setError,
  } = useChatStore()

  // Settings store state
  const {
    ai: aiSettings,
    setAIProvider,
  } = useSettingsStore()

  // Local state
  const [inputValue, setInputValue] = React.useState('')

  // Scroll to bottom when messages change
  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent])

  // Initialize conversation if needed
  React.useEffect(() => {
    if (!currentConversation && documentId) {
      startConversation({
        title: 'New Chat',
        documentIds: [documentId],
        provider: aiSettings.provider,
        modelId:
          aiSettings.provider === 'local'
            ? aiSettings.localModelId
            : aiSettings.openRouterModelId,
      })
    }
  }, [currentConversation, documentId, aiSettings, startConversation])

  // Handle message submission
  const handleSubmit = React.useCallback(
    (message: string) => {
      setInputValue('')
      setError(null)
      onSendMessage?.(message)
    },
    [onSendMessage, setError]
  )

  // Handle provider change
  const handleProviderChange = React.useCallback(
    (provider: AIProvider) => {
      setAIProvider(provider)
    },
    [setAIProvider]
  )

  // Export conversation
  const handleExport = React.useCallback(() => {
    if (!currentConversation || messages.length === 0) return

    const exportData = {
      title: currentConversation.title,
      exportedAt: new Date().toISOString(),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        citations: m.citations,
      })),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `chat-${currentConversation.id}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [currentConversation, messages])

  // Clear conversation
  const handleClear = React.useCallback(() => {
    if (currentConversation) {
      clearConversation(currentConversation.id)
    }
  }, [currentConversation, clearConversation])

  // Collapse button
  const CollapseButton = collapsible ? (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={onToggle}
      aria-label={isOpen ? 'Collapse chat' : 'Expand chat'}
    >
      {position === 'right' ? (
        isOpen ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )
      ) : isOpen ? (
        <ChevronLeft className="h-4 w-4" />
      ) : (
        <ChevronRight className="h-4 w-4" />
      )}
    </Button>
  ) : null

  // Collapsed state
  if (!isOpen && collapsible) {
    return (
      <div
        className={cn(
          'flex flex-col items-center gap-2 border-l bg-background p-2',
          position === 'left' && 'border-r border-l-0',
          className
        )}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                aria-label="Open chat"
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={position === 'right' ? 'left' : 'right'}>
              <p>Open chat</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col border-l bg-background',
        position === 'left' && 'border-r border-l-0',
        className
      )}
      style={{ width: typeof width === 'number' ? `${width}px` : width }}
    >
      {/* Header */}
      <div className="flex flex-col border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {CollapseButton}
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold">Chat with PDF</span>
          </div>

          <div className="flex items-center gap-1">
            {/* RAG Status Indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs">
                    {indexingProgress && indexingProgress.stage !== 'complete' && indexingProgress.stage !== 'error' ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">Indexing...</span>
                      </>
                    ) : indexingProgress?.stage === 'error' ? (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                        <span className="text-destructive">Error</span>
                      </>
                    ) : isDocumentIndexed ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-green-600">{indexedChunkCount} chunks</span>
                      </>
                    ) : (
                      <>
                        <Database className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Not indexed</span>
                      </>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {indexingProgress && indexingProgress.stage !== 'complete' && indexingProgress.stage !== 'error' ? (
                    <p>Indexing document for RAG ({indexingProgress.progress}%)</p>
                  ) : indexingProgress?.stage === 'error' ? (
                    <p>Indexing failed: {indexingProgress.error}</p>
                  ) : isDocumentIndexed ? (
                    <p>Document indexed with {indexedChunkCount} chunks for semantic search</p>
                  ) : (
                    <p>Document not yet indexed for RAG</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Re-index button */}
            {isDocumentIndexed && onReindex && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={onReindex}
                      disabled={indexingProgress?.stage !== 'complete' && indexingProgress?.stage !== 'error' && indexingProgress !== null}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Re-index document</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* AI Provider Toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={aiSettings.provider === 'local' ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() =>
                      handleProviderChange(
                        aiSettings.provider === 'local' ? 'openrouter' : 'local'
                      )
                    }
                    disabled={aiSettings.provider === 'local' && !cloudProviderAvailable}
                  >
                    {aiSettings.provider === 'local' ? (
                      <>
                        <Cpu className="h-3.5 w-3.5" />
                        <span className="text-xs">Local</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="h-3.5 w-3.5" />
                        <span className="text-xs">Cloud</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {aiSettings.provider === 'local'
                      ? cloudProviderAvailable
                        ? 'Using local AI (private, runs in browser)'
                        : 'Cloud AI is unavailable on the configured backend'
                      : 'Using cloud AI (requires API key)'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Settings dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Chat Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExport} disabled={messages.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export conversation
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleClear}
                  disabled={messages.length === 0}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Indexing Progress Bar */}
        {indexingProgress && indexingProgress.stage !== 'complete' && indexingProgress.stage !== 'error' && (
          <div className="px-4 pb-2">
            <Progress value={indexingProgress.progress} className="h-1" />
            <p className="mt-1 text-xs text-muted-foreground">
              {getIndexingStageLabel(indexingProgress.stage)}
              {indexingProgress.totalChunks && ` (${indexingProgress.totalChunks} chunks)`}
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
      >
        {messages.length === 0 && !isGenerating ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 font-semibold">Chat with your PDF</h3>
            <p className="text-sm text-muted-foreground">
              Ask questions about your document and get instant answers with
              citations.
            </p>
          </div>
        ) : (
          <div className="space-y-1 py-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onRegenerate={onRegenerate}
                onCitationNavigate={onCitationNavigate}
                canRegenerate={!isGenerating}
              />
            ))}

            {/* Streaming message */}
            {isGenerating && streamingContent && (
              <StreamingMessage content={streamingContent} />
            )}

            {/* Error message */}
            {error && (
              <div className="mx-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">Error</p>
                <p className="text-destructive/80">{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-auto p-0 text-xs underline"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          isLoading={isGenerating}
          documentType={documentType}
          showSuggestions={messages.length === 0}
          placeholder={
            aiSettings.provider === 'local'
              ? 'Ask a question (running locally)...'
              : 'Ask a question...'
          }
        />

        {/* Provider info */}
        <div className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          {aiSettings.provider === 'local' ? (
            <>
              <Cpu className="h-3 w-3" />
              <span>Running locally in your browser - your data stays private</span>
            </>
          ) : (
            <>
              <Cloud className="h-3 w-3" />
              <span>
                Using {aiSettings.openRouterModelId.split('/').pop()} via OpenRouter
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Get human-readable label for indexing stage
 */
function getIndexingStageLabel(stage: string): string {
  switch (stage) {
    case 'initializing':
      return 'Initializing embedding model...'
    case 'chunking':
      return 'Splitting document into chunks...'
    case 'embedding':
      return 'Generating embeddings...'
    case 'storing':
      return 'Storing embeddings...'
    case 'complete':
      return 'Indexing complete'
    case 'error':
      return 'Indexing failed'
    default:
      return 'Processing...'
  }
}

/**
 * Floating chat button for opening the panel
 */
export function ChatToggleButton({
  onClick,
  isOpen,
  unreadCount = 0,
  className,
}: {
  onClick: () => void
  isOpen?: boolean
  unreadCount?: number
  className?: string
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isOpen ? 'default' : 'outline'}
            size="icon"
            className={cn(
              'relative h-12 w-12 rounded-full shadow-lg',
              className
            )}
            onClick={onClick}
            aria-label={isOpen ? 'Close chat' : 'Open chat'}
          >
            {isOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <MessageSquare className="h-5 w-5" />
            )}
            {unreadCount > 0 && !isOpen && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{isOpen ? 'Close chat' : 'Chat with PDF'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
