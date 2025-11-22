/**
 * AI Chat State Management
 * Manages conversations, messages, and AI generation state
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Conversation,
  Message,
  MessageRole,
  Citation,
  MessageAttachment,
  ConversationContext,
  AIProvider,
} from '@pdflover/shared';

/**
 * Generate a unique ID for messages and conversations
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Chat store state interface
 */
export interface ChatState {
  /** All conversations */
  conversations: Conversation[];
  /** Currently active conversation */
  currentConversation: Conversation | null;
  /** Messages in current conversation (denormalized for performance) */
  messages: Message[];
  /** Whether AI is generating a response */
  isGenerating: boolean;
  /** Current streaming message content */
  streamingContent: string;
  /** Loading state for conversation operations */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

/**
 * Options for creating a new conversation
 */
export interface CreateConversationOptions {
  title?: string;
  documentIds?: string[];
  provider?: AIProvider;
  modelId?: string;
}

/**
 * Options for adding a message
 */
export interface AddMessageOptions {
  role: MessageRole;
  content: string;
  citations?: Citation[];
  attachments?: MessageAttachment[];
  model?: string;
  processingTime?: number;
}

/**
 * Chat store actions interface
 */
export interface ChatActions {
  /** Start a new conversation */
  startConversation: (options?: CreateConversationOptions) => Conversation;
  /** Set the current active conversation */
  setCurrentConversation: (conversationId: string | null) => void;
  /** Add a message to the current conversation */
  addMessage: (options: AddMessageOptions) => Message;
  /** Update a message */
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  /** Delete a message */
  deleteMessage: (messageId: string) => void;
  /** Clear the current conversation */
  clearConversation: (conversationId?: string) => void;
  /** Delete a conversation */
  deleteConversation: (conversationId: string) => void;
  /** Update conversation title */
  updateConversationTitle: (conversationId: string, title: string) => void;
  /** Add document to conversation context */
  addDocumentToContext: (conversationId: string, documentId: string) => void;
  /** Remove document from conversation context */
  removeDocumentFromContext: (conversationId: string, documentId: string) => void;
  /** Set generating state */
  setIsGenerating: (isGenerating: boolean) => void;
  /** Update streaming content */
  setStreamingContent: (content: string) => void;
  /** Append to streaming content */
  appendStreamingContent: (chunk: string) => void;
  /** Finalize streaming message */
  finalizeStreamingMessage: (citations?: Citation[], model?: string) => void;
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Clear all conversations */
  clearAllConversations: () => void;
}

/**
 * Combined chat store type
 */
export type ChatStore = ChatState & ChatActions;

/**
 * Create default conversation context
 */
const createDefaultContext = (documentIds: string[] = []): ConversationContext => ({
  documentIds,
  chunks: [],
  isLoaded: documentIds.length === 0,
});

/**
 * Initial state for the chat store
 */
const initialState: ChatState = {
  conversations: [],
  currentConversation: null,
  messages: [],
  isGenerating: false,
  streamingContent: '',
  isLoading: false,
  error: null,
};

/**
 * AI chat store
 * Manages conversations, messages, and AI generation state
 */
export const useChatStore = create<ChatStore>()(
  immer((set, get) => ({
    ...initialState,

    startConversation: (options?: CreateConversationOptions): Conversation => {
      const conversation: Conversation = {
        id: generateId(),
        title: options?.title ?? 'New Conversation',
        messages: [],
        context: createDefaultContext(options?.documentIds),
        provider: options?.provider ?? 'local',
        modelId: options?.modelId ?? 'Xenova/flan-t5-small',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        totalTokens: 0,
      };

      set((state) => {
        // Deactivate other conversations
        for (const conv of state.conversations) {
          conv.isActive = false;
        }
        state.conversations.unshift(conversation);
        state.currentConversation = conversation;
        state.messages = [];
        state.error = null;
      });

      return conversation;
    },

    setCurrentConversation: (conversationId: string | null) => {
      set((state) => {
        if (conversationId === null) {
          state.currentConversation = null;
          state.messages = [];
          // Deactivate all conversations
          for (const conv of state.conversations) {
            conv.isActive = false;
          }
          return;
        }

        const conversation = state.conversations.find((c) => c.id === conversationId);
        if (conversation) {
          // Deactivate other conversations
          for (const conv of state.conversations) {
            conv.isActive = conv.id === conversationId;
          }
          state.currentConversation = conversation;
          state.messages = [...conversation.messages];
        }
      });
    },

    addMessage: (options: AddMessageOptions): Message => {
      const message: Message = {
        id: generateId(),
        role: options.role,
        content: options.content,
        citations: options.citations,
        attachments: options.attachments,
        timestamp: new Date(),
        model: options.model,
        processingTime: options.processingTime,
      };

      set((state) => {
        if (state.currentConversation) {
          // Add to current conversation's messages
          state.currentConversation.messages.push(message);
          state.currentConversation.updatedAt = new Date();

          // Update in conversations array
          const convIndex = state.conversations.findIndex(
            (c) => c.id === state.currentConversation?.id
          );
          if (convIndex !== -1) {
            state.conversations[convIndex] = state.currentConversation;
          }

          // Update local messages array
          state.messages.push(message);
        }
      });

      return message;
    },

    updateMessage: (messageId: string, updates: Partial<Message>) => {
      set((state) => {
        // Update in messages array
        const messageIndex = state.messages.findIndex((m) => m.id === messageId);
        if (messageIndex !== -1) {
          state.messages[messageIndex] = {
            ...state.messages[messageIndex],
            ...updates,
          };
        }

        // Update in current conversation
        if (state.currentConversation) {
          const convMsgIndex = state.currentConversation.messages.findIndex(
            (m) => m.id === messageId
          );
          if (convMsgIndex !== -1) {
            state.currentConversation.messages[convMsgIndex] = {
              ...state.currentConversation.messages[convMsgIndex],
              ...updates,
            };
            state.currentConversation.updatedAt = new Date();
          }

          // Sync to conversations array
          const convIndex = state.conversations.findIndex(
            (c) => c.id === state.currentConversation?.id
          );
          if (convIndex !== -1) {
            state.conversations[convIndex] = state.currentConversation;
          }
        }
      });
    },

    deleteMessage: (messageId: string) => {
      set((state) => {
        // Remove from messages array
        state.messages = state.messages.filter((m) => m.id !== messageId);

        // Remove from current conversation
        if (state.currentConversation) {
          state.currentConversation.messages = state.currentConversation.messages.filter(
            (m) => m.id !== messageId
          );
          state.currentConversation.updatedAt = new Date();

          // Sync to conversations array
          const convIndex = state.conversations.findIndex(
            (c) => c.id === state.currentConversation?.id
          );
          if (convIndex !== -1) {
            state.conversations[convIndex] = state.currentConversation;
          }
        }
      });
    },

    clearConversation: (conversationId?: string) => {
      set((state) => {
        const targetId = conversationId ?? state.currentConversation?.id;
        if (!targetId) return;

        const convIndex = state.conversations.findIndex((c) => c.id === targetId);
        if (convIndex !== -1) {
          state.conversations[convIndex].messages = [];
          state.conversations[convIndex].updatedAt = new Date();
          state.conversations[convIndex].totalTokens = 0;

          // Clear current messages if clearing current conversation
          if (state.currentConversation?.id === targetId) {
            state.currentConversation.messages = [];
            state.currentConversation.totalTokens = 0;
            state.messages = [];
          }
        }
      });
    },

    deleteConversation: (conversationId: string) => {
      set((state) => {
        state.conversations = state.conversations.filter((c) => c.id !== conversationId);

        // Clear current if deleted
        if (state.currentConversation?.id === conversationId) {
          state.currentConversation = null;
          state.messages = [];
        }
      });
    },

    updateConversationTitle: (conversationId: string, title: string) => {
      set((state) => {
        const convIndex = state.conversations.findIndex((c) => c.id === conversationId);
        if (convIndex !== -1) {
          state.conversations[convIndex].title = title;
          state.conversations[convIndex].updatedAt = new Date();

          if (state.currentConversation?.id === conversationId) {
            state.currentConversation.title = title;
          }
        }
      });
    },

    addDocumentToContext: (conversationId: string, documentId: string) => {
      set((state) => {
        const convIndex = state.conversations.findIndex((c) => c.id === conversationId);
        if (convIndex !== -1) {
          const context = state.conversations[convIndex].context;
          if (!context.documentIds.includes(documentId)) {
            context.documentIds.push(documentId);
            context.isLoaded = false; // Mark as needing reload
            state.conversations[convIndex].updatedAt = new Date();
          }

          if (state.currentConversation?.id === conversationId) {
            state.currentConversation.context = context;
          }
        }
      });
    },

    removeDocumentFromContext: (conversationId: string, documentId: string) => {
      set((state) => {
        const convIndex = state.conversations.findIndex((c) => c.id === conversationId);
        if (convIndex !== -1) {
          const context = state.conversations[convIndex].context;
          context.documentIds = context.documentIds.filter((id) => id !== documentId);
          context.chunks = context.chunks?.filter((chunk) => chunk.documentId !== documentId);
          state.conversations[convIndex].updatedAt = new Date();

          if (state.currentConversation?.id === conversationId) {
            state.currentConversation.context = context;
          }
        }
      });
    },

    setIsGenerating: (isGenerating: boolean) => {
      set((state) => {
        state.isGenerating = isGenerating;
        if (!isGenerating) {
          state.streamingContent = '';
        }
      });
    },

    setStreamingContent: (content: string) => {
      set((state) => {
        state.streamingContent = content;
      });
    },

    appendStreamingContent: (chunk: string) => {
      set((state) => {
        state.streamingContent += chunk;
      });
    },

    finalizeStreamingMessage: (citations?: Citation[], model?: string) => {
      const { streamingContent, addMessage } = get();
      if (streamingContent) {
        addMessage({
          role: 'assistant',
          content: streamingContent,
          citations,
          model,
        });
      }
      set((state) => {
        state.streamingContent = '';
        state.isGenerating = false;
      });
    },

    setLoading: (isLoading: boolean) => {
      set((state) => {
        state.isLoading = isLoading;
      });
    },

    setError: (error: string | null) => {
      set((state) => {
        state.error = error;
        if (error) {
          state.isGenerating = false;
        }
      });
    },

    clearAllConversations: () => {
      set((state) => {
        state.conversations = [];
        state.currentConversation = null;
        state.messages = [];
        state.streamingContent = '';
        state.isGenerating = false;
        state.error = null;
      });
    },
  }))
);

/**
 * Selector: Get conversation by ID
 */
export const selectConversationById = (conversationId: string) => (state: ChatStore) =>
  state.conversations.find((c) => c.id === conversationId);

/**
 * Selector: Get recent conversations (sorted by updatedAt)
 */
export const selectRecentConversations = (limit: number = 10) => (state: ChatStore) =>
  [...state.conversations]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);

/**
 * Selector: Get conversations for a specific document
 */
export const selectConversationsForDocument = (documentId: string) => (state: ChatStore) =>
  state.conversations.filter((c) => c.context.documentIds.includes(documentId));

/**
 * Selector: Get current message count
 */
export const selectMessageCount = (state: ChatStore) => state.messages.length;

/**
 * Selector: Check if there are any messages
 */
export const selectHasMessages = (state: ChatStore) => state.messages.length > 0;

/**
 * Selector: Get last message
 */
export const selectLastMessage = (state: ChatStore) =>
  state.messages.length > 0 ? state.messages[state.messages.length - 1] : null;

/**
 * Selector: Get user messages only
 */
export const selectUserMessages = (state: ChatStore) =>
  state.messages.filter((m) => m.role === 'user');

/**
 * Selector: Get assistant messages only
 */
export const selectAssistantMessages = (state: ChatStore) =>
  state.messages.filter((m) => m.role === 'assistant');
