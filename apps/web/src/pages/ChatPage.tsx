/**
 * Chat with PDF Page
 * Side-by-side layout with PDF viewer and chat panel
 * Integrates RAG pipeline for document-aware conversations
 */

import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  FileText,
  Upload,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChatPanel, ChatToggleButton } from "@/components/chat/ChatPanel";
import { useDocumentTypeDetection } from "@/components/chat/SuggestedQuestions";
import { useChatStore } from "@/store/chat-store";
import { usePDFStore } from "@/store/pdf-store";
import { useSettingsStore } from "@/store/settings-store";
import { useRAG } from "@/hooks/useRAG";
import { cn } from "@/lib/utils";
import {
  generateLocalResponse,
  generateLocalResponseStream,
  initializeLocalModel,
} from "@/lib/ai/local-llm";
import { sendChatCompletion, streamChatCompletion } from "@/lib/ai/openrouter";
import { queryWithContext } from "@/lib/ai/rag";
import type { Citation, Message, PDFPage } from "@pdflover/shared";
import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { db } from "@/lib/storage";

function PDFViewer({
  documentId,
  highlightCitation,
  className,
}: {
  documentId: string;
  onPageChange?: (page: number) => void;
  highlightCitation?: Citation | null;
  className?: string;
}) {
  const { currentDocument } = usePDFStore();

  if (!currentDocument) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="text-center text-muted-foreground">
          <FileText className="mx-auto h-12 w-12 opacity-50" />
          <p className="mt-2">No document loaded</p>
        </div>
      </div>
    );
  }

  if (!currentDocument.data) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center text-sm text-destructive",
          className,
        )}
      >
        Stored document bytes are unavailable.
      </div>
    );
  }

  return (
    <PdfViewer
      key={`${documentId}-${highlightCitation?.pageNumber ?? 1}`}
      arrayBuffer={currentDocument.data}
      initialPage={highlightCitation?.pageNumber ?? 1}
      showToolbar
      enableSearch
      className={className}
    />
  );
}

/**
 * Empty state when no document is loaded
 */
function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">Chat with your PDF</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Upload a PDF document to start asking questions. Your document is
            processed locally - nothing is uploaded to any server.
          </p>
          <Button onClick={onUpload} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Loading state while processing document
 */
function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

/**
 * ChatPage component provides side-by-side PDF viewer and chat interface
 */
export function ChatPage() {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("document");
  const navigate = useNavigate();

  // Stores
  const {
    currentDocument,
    isLoading: isPdfLoading,
    error: pdfError,
    addDocument,
    setCurrentDocument,
    setLoading: setPdfLoading,
    setError: setPdfError,
  } = usePDFStore();

  const {
    messages,
    currentConversation,
    isGenerating,
    streamingContent,
    startConversation,
    addMessage,
    setIsGenerating,
    appendStreamingContent,
    finalizeStreamingMessage,
    setError,
  } = useChatStore();

  const { ai: aiSettings } = useSettingsStore();

  // RAG hook for document indexing and querying
  const {
    indexingState,
    indexDocument: indexDocumentRAG,
    query: queryRAG,
    checkIndexed,
  } = useRAG({
    chunkSize: aiSettings.ragChunkSize,
    chunkOverlap: aiSettings.ragChunkOverlap,
    topK: aiSettings.ragTopK,
    minSimilarity: 0.3,
    persist: true,
  });

  // Local state
  const [chatOpen, setChatOpen] = React.useState(true);
  const [highlightedCitation, setHighlightedCitation] =
    React.useState<Citation | null>(null);

  React.useEffect(() => {
    if (!documentId || currentDocument?.id === documentId) return;
    let cancelled = false;
    setPdfLoading(true);
    setPdfError(null);
    void Promise.all([
      db.getDocument(documentId),
      db.getDocumentBytes(documentId),
    ])
      .then(async ([stored, blob]) => {
        if (!stored || !blob)
          throw new Error("The selected library document is unavailable");
        const data = await blob.arrayBuffer();
        const proxy = await pdfjsLib.getDocument({ data: data.slice(0) })
          .promise;
        const pages: PDFPage[] = [];
        for (
          let pageNumber = 1;
          pageNumber <= proxy.numPages;
          pageNumber += 1
        ) {
          const page = await proxy.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1 });
          const content = await page.getTextContent();
          const textContent = content.items
            .filter((item): item is TextItem => "str" in item)
            .map((item) => `${item.str}${item.hasEOL ? "\n" : " "}`)
            .join("")
            .trim();
          pages.push({
            pageNumber,
            width: viewport.width,
            height: viewport.height,
            rotation: (viewport.rotation % 360) as 0 | 90 | 180 | 270,
            textContent,
          });
        }
        await proxy.destroy();
        if (cancelled) return;
        const document = {
          id: stored.id,
          filename: stored.filename,
          fileSize: stored.fileSize,
          mimeType: "application/pdf" as const,
          pageCount: stored.pageCount,
          metadata: stored.metadata,
          pages,
          data,
          createdAt: stored.createdAt,
          updatedAt: stored.updatedAt,
        };
        addDocument(document);
        setCurrentDocument(document);
        setPdfLoading(false);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setPdfError(
            cause instanceof Error ? cause.message : "Failed to load document",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    addDocument,
    currentDocument?.id,
    documentId,
    setCurrentDocument,
    setPdfError,
    setPdfLoading,
  ]);

  // Detect document type from content
  const documentText =
    currentDocument?.pages.map((p) => p.textContent || "").join(" ") || "";
  const documentType = useDocumentTypeDetection(documentText);

  // Initialize conversation when document loads
  React.useEffect(() => {
    if (currentDocument && !currentConversation) {
      startConversation({
        title: `Chat: ${currentDocument.filename}`,
        documentIds: [currentDocument.id],
        provider: aiSettings.provider,
        modelId:
          aiSettings.provider === "local"
            ? aiSettings.localModelId
            : aiSettings.openRouterModelId,
      });
    }
  }, [currentDocument, currentConversation, aiSettings, startConversation]);

  // Index document for RAG when loaded
  React.useEffect(() => {
    if (
      currentDocument &&
      !indexingState.isIndexed &&
      !indexingState.isIndexing
    ) {
      indexDocumentRAG({
        id: currentDocument.id,
        name: currentDocument.filename,
        pages: currentDocument.pages.map((page) => ({
          pageNumber: page.pageNumber,
          textContent: page.textContent,
        })),
      });
    }
  }, [
    currentDocument,
    indexingState.isIndexed,
    indexingState.isIndexing,
    indexDocumentRAG,
  ]);

  // Initialize AI model
  React.useEffect(() => {
    if (aiSettings.provider === "local") {
      initializeLocalModel(aiSettings.localModelId).then((result) => {
        if (!result.success) {
          console.error("Failed to initialize local model:", result.error);
        }
      });
    }
  }, [aiSettings.provider, aiSettings.localModelId]);

  // Handle sending a message
  const handleSendMessage = React.useCallback(
    async (content: string) => {
      if (!currentDocument || !currentConversation) return;

      // Add user message
      const userMessage = addMessage({
        role: "user",
        content,
      });

      setIsGenerating(true);

      try {
        // Get relevant context using RAG
        const ragResult = await queryWithContext(content, currentDocument.id, {
          topK: aiSettings.ragTopK,
          minSimilarity: 0.3,
          maxContextLength: 4000,
        });

        const { context } = ragResult;
        const citations = context.citations;

        // Build messages array for API
        const apiMessages: Message[] = [
          ...messages,
          {
            id: userMessage.id,
            role: "user" as const,
            content,
            timestamp: new Date(),
          },
        ];

        // Build system prompt with RAG context
        const systemPrompt = context.contextText
          ? `You are a helpful AI assistant that answers questions about documents.
When answering, reference specific parts of the provided context and include page numbers as citations.
If you cannot find the answer in the context, say so clearly.

## Document Context
${context.contextText}

## Instructions
- Answer based on the context above
- Include page number citations when referencing specific information (e.g., [Page 3])
- Be concise and accurate`
          : undefined;

        // Generate response based on provider
        if (aiSettings.provider === "local") {
          if (aiSettings.enableStreaming) {
            // Streaming response
            for await (const chunk of generateLocalResponseStream(apiMessages, {
              modelId: aiSettings.localModelId,
              systemPrompt,
              temperature: aiSettings.defaultTemperature,
              maxTokens: aiSettings.defaultMaxTokens,
            })) {
              appendStreamingContent(chunk.delta);
              if (chunk.isFinished) {
                finalizeStreamingMessage(citations, aiSettings.localModelId);
              }
            }
          } else {
            // Non-streaming response
            const response = await generateLocalResponse(apiMessages, {
              modelId: aiSettings.localModelId,
              systemPrompt,
              temperature: aiSettings.defaultTemperature,
              maxTokens: aiSettings.defaultMaxTokens,
            });

            addMessage({
              role: "assistant",
              content: response.message.content,
              citations,
              model: response.model,
              processingTime: response.message.processingTime,
            });
          }
        } else {
          // Cloud AI is proxied by the backend so provider credentials never
          // enter browser storage.
          if (aiSettings.enableStreaming) {
            // Streaming response
            for await (const chunk of streamChatCompletion(apiMessages, {
              modelId: aiSettings.openRouterModelId,
              systemPrompt,
              temperature: aiSettings.defaultTemperature,
              maxTokens: aiSettings.defaultMaxTokens,
            })) {
              appendStreamingContent(chunk.delta);
              if (chunk.isFinished) {
                finalizeStreamingMessage(
                  citations,
                  aiSettings.openRouterModelId,
                );
              }
            }
          } else {
            // Non-streaming response
            const response = await sendChatCompletion(apiMessages, {
              modelId: aiSettings.openRouterModelId,
              systemPrompt,
              temperature: aiSettings.defaultTemperature,
              maxTokens: aiSettings.defaultMaxTokens,
            });

            addMessage({
              role: "assistant",
              content: response.message.content,
              citations,
              model: response.model,
              processingTime: response.message.processingTime,
            });
          }
        }
      } catch (error) {
        console.error("Failed to generate response:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to generate response",
        );
        setIsGenerating(false);
      }
    },
    [
      currentDocument,
      currentConversation,
      messages,
      aiSettings,
      addMessage,
      setIsGenerating,
      appendStreamingContent,
      finalizeStreamingMessage,
      setError,
    ],
  );

  // Handle regenerating a response
  const handleRegenerate = React.useCallback(
    (messageId: string) => {
      // Find the message before this one (should be user message)
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex <= 0) return;

      const userMessage = messages[messageIndex - 1];
      if (userMessage.role !== "user") return;

      // Resend the user's message
      handleSendMessage(userMessage.content);
    },
    [messages, handleSendMessage],
  );

  // Handle citation navigation
  const handleCitationNavigate = React.useCallback((citation: Citation) => {
    setHighlightedCitation(citation);

    // Clear highlight after a delay
    setTimeout(() => setHighlightedCitation(null), 3000);
  }, []);

  const handleUpload = React.useCallback(() => {
    navigate("/files");
  }, [navigate]);

  // Show loading state (only block UI if PDF is loading, not during indexing)
  if (isPdfLoading) {
    return <LoadingState message="Loading document..." />;
  }

  // Show error state
  if (pdfError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-sm text-muted-foreground">{pdfError}</p>
          <Button onClick={() => navigate("/")}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Show empty state
  if (!currentDocument) {
    return <EmptyState onUpload={handleUpload} />;
  }

  return (
    <div className="flex h-full">
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 top-4 z-10"
        onClick={() => navigate("/")}
        aria-label="Go back"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      {/* PDF Viewer */}
      <div className={cn("flex-1 transition-all", chatOpen ? "mr-0" : "mr-0")}>
        <PDFViewer
          documentId={currentDocument.id}
          highlightCitation={highlightedCitation}
          className="h-full"
        />
      </div>

      {/* Chat Panel */}
      <ChatPanel
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
        onSendMessage={handleSendMessage}
        onRegenerate={handleRegenerate}
        onCitationNavigate={handleCitationNavigate}
        documentType={documentType}
        documentId={currentDocument.id}
        collapsible
        position="right"
        width={400}
        indexingProgress={indexingState.progress}
        isDocumentIndexed={indexingState.isIndexed}
        indexedChunkCount={indexingState.chunkCount}
        onReindex={() => {
          indexDocumentRAG(
            {
              id: currentDocument.id,
              name: currentDocument.filename,
              pages: currentDocument.pages.map((page) => ({
                pageNumber: page.pageNumber,
                textContent: page.textContent,
              })),
            },
            true,
          );
        }}
      />

      {/* Floating chat button (when collapsed) */}
      {!chatOpen && (
        <ChatToggleButton
          onClick={() => setChatOpen(true)}
          isOpen={chatOpen}
          className="fixed bottom-6 right-6"
        />
      )}
    </div>
  );
}

export default ChatPage;
