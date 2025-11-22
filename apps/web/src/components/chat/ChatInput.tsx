/**
 * Chat Input Component
 * Message input with auto-resize and keyboard shortcuts
 */

import * as React from 'react'
import { Send, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { SuggestedQuestions, DocumentType } from './SuggestedQuestions'

export interface ChatInputProps {
  /** Current input value */
  value: string
  /** Callback when input changes */
  onChange: (value: string) => void
  /** Callback when message is submitted */
  onSubmit: (message: string) => void
  /** Whether the AI is currently generating */
  isLoading?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Whether to show suggested questions */
  showSuggestions?: boolean
  /** Document type for contextual suggestions */
  documentType?: DocumentType
  /** Custom suggested questions */
  suggestions?: string[]
  /** Callback when suggestion is selected */
  onSuggestionSelect?: (suggestion: string) => void
  /** Maximum character limit */
  maxLength?: number
  /** Whether the input is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * ChatInput component provides a textarea with auto-resize,
 * send button, and keyboard shortcuts for chat interaction.
 *
 * @example
 * ```tsx
 * <ChatInput
 *   value={inputValue}
 *   onChange={setInputValue}
 *   onSubmit={handleSendMessage}
 *   isLoading={isGenerating}
 *   placeholder="Ask about this document..."
 * />
 * ```
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = 'Ask a question about this document...',
  showSuggestions = true,
  documentType = 'general',
  suggestions,
  onSuggestionSelect,
  maxLength = 4000,
  disabled = false,
  className,
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [showSuggestionsPanel, setShowSuggestionsPanel] = React.useState(true)

  // Auto-resize textarea
  const adjustTextareaHeight = React.useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 200) // Max 200px
      textarea.style.height = `${newHeight}px`
    }
  }, [])

  React.useEffect(() => {
    adjustTextareaHeight()
  }, [value, adjustTextareaHeight])

  // Handle input change
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      if (maxLength && newValue.length > maxLength) {
        return
      }
      onChange(newValue)
      // Hide suggestions when user starts typing
      if (newValue.length > 0) {
        setShowSuggestionsPanel(false)
      } else {
        setShowSuggestionsPanel(true)
      }
    },
    [onChange, maxLength]
  )

  // Handle form submit
  const handleSubmit = React.useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      const trimmedValue = value.trim()
      if (!trimmedValue || isLoading || disabled) {
        return
      }
      onSubmit(trimmedValue)
      setShowSuggestionsPanel(true)
    },
    [value, isLoading, disabled, onSubmit]
  )

  // Handle keyboard shortcuts
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter to send (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  // Handle suggestion selection
  const handleSuggestionSelect = React.useCallback(
    (question: string) => {
      onChange(question)
      setShowSuggestionsPanel(false)
      textareaRef.current?.focus()
      onSuggestionSelect?.(question)
    },
    [onChange, onSuggestionSelect]
  )

  const canSubmit = value.trim().length > 0 && !isLoading && !disabled
  const characterCount = value.length
  const isNearLimit = maxLength && characterCount > maxLength * 0.9

  return (
    <div className={cn('space-y-3', className)}>
      {/* Suggestions */}
      {showSuggestions && showSuggestionsPanel && value.length === 0 && (
        <SuggestedQuestions
          documentType={documentType}
          questions={suggestions?.map((text) => ({ text }))}
          onSelect={handleSuggestionSelect}
          variant="compact"
          maxQuestions={3}
        />
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-end rounded-lg border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
              'min-h-[48px] max-h-[200px]'
            )}
            aria-label="Chat message input"
          />

          {/* Send button */}
          <div className="flex items-center gap-2 p-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!canSubmit}
                    className="h-8 w-8 shrink-0"
                    aria-label={isLoading ? 'Generating...' : 'Send message'}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>
                    {isLoading
                      ? 'Generating...'
                      : 'Send message (Enter)'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Character count */}
        {maxLength && (
          <div
            className={cn(
              'absolute bottom-1 left-4 text-xs text-muted-foreground',
              isNearLimit && 'text-amber-500',
              characterCount >= maxLength && 'text-destructive'
            )}
          >
            {characterCount}/{maxLength}
          </div>
        )}

        {/* Keyboard hint */}
        <div className="mt-1 flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">
            Press Enter to send, Shift+Enter for new line
          </span>
        </div>
      </form>
    </div>
  )
}

/**
 * Standalone chat input with state management
 */
export function ChatInputWithState({
  onSubmit,
  ...props
}: Omit<ChatInputProps, 'value' | 'onChange'> & {
  onSubmit: (message: string) => void
}) {
  const [value, setValue] = React.useState('')

  const handleSubmit = React.useCallback(
    (message: string) => {
      onSubmit(message)
      setValue('')
    },
    [onSubmit]
  )

  return (
    <ChatInput
      {...props}
      value={value}
      onChange={setValue}
      onSubmit={handleSubmit}
    />
  )
}
