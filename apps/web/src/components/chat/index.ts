/**
 * Chat Components
 * AI chat interface components for PDFLover
 */

// Main chat panel
export { ChatPanel, ChatToggleButton } from './ChatPanel'
export type { ChatPanelProps } from './ChatPanel'

// Message display
export { MessageBubble, StreamingMessage } from './MessageBubble'
export type { MessageBubbleProps } from './MessageBubble'

// Input components
export { ChatInput, ChatInputWithState } from './ChatInput'
export type { ChatInputProps } from './ChatInput'

// Citations
export { CitationLink, CitationList } from './CitationLink'
export type { CitationLinkProps, CitationListProps } from './CitationLink'

// Suggestions
export {
  SuggestedQuestions,
  useDocumentTypeDetection,
} from './SuggestedQuestions'
export type {
  SuggestedQuestionsProps,
  SuggestedQuestion,
  DocumentType,
} from './SuggestedQuestions'
