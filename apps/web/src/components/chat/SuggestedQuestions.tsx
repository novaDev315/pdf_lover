/**
 * Suggested Questions Component
 * Displays contextual question suggestions based on document type
 */

import * as React from 'react'
import { Lightbulb, ChevronRight, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Document type for contextual suggestions
 */
export type DocumentType =
  | 'general'
  | 'report'
  | 'contract'
  | 'academic'
  | 'financial'
  | 'technical'
  | 'legal'

/**
 * Default questions by document type
 */
const DEFAULT_QUESTIONS: Record<DocumentType, string[]> = {
  general: [
    'What is the main topic of this document?',
    'Summarize the key points in this document',
    'What are the main conclusions?',
    'List the important dates mentioned',
  ],
  report: [
    'What are the main findings of this report?',
    'Summarize the executive summary',
    'What recommendations are made?',
    'What data sources were used?',
  ],
  contract: [
    'What are the key terms and conditions?',
    'When does this contract expire?',
    'What are the payment terms?',
    'List all parties involved in this contract',
  ],
  academic: [
    'What is the main thesis or argument?',
    'Summarize the methodology used',
    'What are the key findings?',
    'List the main references cited',
  ],
  financial: [
    'What is the total revenue reported?',
    'Summarize the financial highlights',
    'What are the key financial metrics?',
    'Compare year-over-year performance',
  ],
  technical: [
    'What are the system requirements?',
    'Explain the architecture described',
    'List the main features or components',
    'What are the limitations mentioned?',
  ],
  legal: [
    'What are the key legal provisions?',
    'Summarize the rights and obligations',
    'Are there any penalties mentioned?',
    'What jurisdiction applies?',
  ],
}

export interface SuggestedQuestion {
  /** Question text */
  text: string
  /** Optional icon */
  icon?: React.ReactNode
  /** Whether this is a featured/highlighted question */
  featured?: boolean
}

export interface SuggestedQuestionsProps {
  /** Document type for contextual suggestions */
  documentType?: DocumentType
  /** Custom questions to display */
  questions?: SuggestedQuestion[]
  /** Callback when a question is selected */
  onSelect: (question: string) => void
  /** Whether to show default questions */
  showDefaults?: boolean
  /** Maximum number of questions to display */
  maxQuestions?: number
  /** Display variant */
  variant?: 'list' | 'chips' | 'compact'
  /** Additional CSS classes */
  className?: string
}

/**
 * SuggestedQuestions component displays clickable question suggestions.
 * Questions can be customized or auto-generated based on document type.
 *
 * @example
 * ```tsx
 * <SuggestedQuestions
 *   documentType="financial"
 *   onSelect={(question) => setInputValue(question)}
 * />
 * ```
 */
export function SuggestedQuestions({
  documentType = 'general',
  questions,
  onSelect,
  showDefaults = true,
  maxQuestions = 4,
  variant = 'list',
  className,
}: SuggestedQuestionsProps) {
  // Combine custom questions with defaults
  const displayQuestions = React.useMemo(() => {
    const customQuestions = questions?.map((q) =>
      typeof q === 'string' ? { text: q } : q
    ) ?? []

    if (!showDefaults) {
      return customQuestions.slice(0, maxQuestions)
    }

    const defaultQuestions = DEFAULT_QUESTIONS[documentType].map((text) => ({
      text,
    }))

    // Prioritize custom questions, then fill with defaults
    const combined = [...customQuestions]
    for (const defaultQ of defaultQuestions) {
      if (combined.length >= maxQuestions) break
      if (!combined.some((q) => q.text === defaultQ.text)) {
        combined.push(defaultQ)
      }
    }

    return combined.slice(0, maxQuestions)
  }, [questions, documentType, showDefaults, maxQuestions])

  if (displayQuestions.length === 0) {
    return null
  }

  if (variant === 'chips') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {displayQuestions.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className={cn(
              'h-auto rounded-full px-3 py-1.5 text-xs',
              question.featured && 'border-primary text-primary'
            )}
            onClick={() => onSelect(question.text)}
          >
            {question.icon}
            {question.text}
          </Button>
        ))}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-1', className)}>
        {displayQuestions.map((question, index) => (
          <button
            key={index}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              question.featured && 'text-primary'
            )}
            onClick={() => onSelect(question.text)}
          >
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="line-clamp-1">{question.text}</span>
          </button>
        ))}
      </div>
    )
  }

  // Default list variant
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Lightbulb className="h-4 w-4" />
        <span>Suggested questions</span>
      </div>
      <div className="space-y-1">
        {displayQuestions.map((question, index) => (
          <button
            key={index}
            className={cn(
              'group flex w-full items-center gap-3 rounded-lg border border-transparent p-3 text-left transition-colors hover:border-border hover:bg-muted/50',
              question.featured && 'border-primary/20 bg-primary/5'
            )}
            onClick={() => onSelect(question.text)}
          >
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary',
                question.featured && 'bg-primary/10 text-primary'
              )}
            >
              {question.icon || (
                question.featured ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )
              )}
            </div>
            <span className="text-sm">{question.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Hook to detect document type from content
 */
export function useDocumentTypeDetection(text: string): DocumentType {
  return React.useMemo(() => {
    const lowerText = text.toLowerCase()

    // Simple keyword-based detection
    const patterns: [DocumentType, string[]][] = [
      ['financial', ['revenue', 'profit', 'loss', 'balance sheet', 'income statement', 'fiscal', 'quarterly']],
      ['contract', ['agreement', 'party', 'parties', 'herein', 'whereas', 'obligation', 'termination']],
      ['academic', ['abstract', 'methodology', 'hypothesis', 'conclusion', 'references', 'citation']],
      ['legal', ['court', 'plaintiff', 'defendant', 'jurisdiction', 'statute', 'legal', 'law']],
      ['technical', ['api', 'documentation', 'implementation', 'architecture', 'system', 'configuration']],
      ['report', ['report', 'findings', 'analysis', 'recommendation', 'executive summary']],
    ]

    for (const [type, keywords] of patterns) {
      const matchCount = keywords.filter((kw) => lowerText.includes(kw)).length
      if (matchCount >= 2) {
        return type
      }
    }

    return 'general'
  }, [text])
}
