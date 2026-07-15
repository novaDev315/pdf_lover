/**
 * Custom hook for PDF document operations
 * Handles loading PDF documents from various sources using PDF.js
 */

import { useState, useCallback, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/**
 * PDF document metadata extracted from the document
 */
export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pdfVersion?: string;
  pageCount: number;
  isEncrypted: boolean;
}

/**
 * Loading state for PDF document
 */
export type PdfLoadingState = "idle" | "loading" | "loaded" | "error";

/**
 * Return type for the usePdfDocument hook
 */
export interface UsePdfDocumentReturn {
  /** The loaded PDF.js document proxy */
  pdfDocument: PDFDocumentProxy | null;
  /** Current loading state */
  loadingState: PdfLoadingState;
  /** Error message if loading failed */
  error: string | null;
  /** Loading progress (0-100) */
  progress: number;
  /** Extracted document metadata */
  metadata: PdfMetadata | null;
  /** Load PDF from a File object */
  loadFromFile: (file: File) => Promise<void>;
  /** Load PDF from an ArrayBuffer */
  loadFromArrayBuffer: (
    buffer: ArrayBuffer,
    filename?: string,
  ) => Promise<void>;
  /** Load PDF from a URL */
  loadFromUrl: (url: string) => Promise<void>;
  /** Close and clean up the current document */
  closeDocument: () => void;
  /** Render a specific page to a canvas */
  renderPage: (
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale?: number,
  ) => Promise<{ width: number; height: number }>;
  /** Get the dimensions of a specific page */
  getPageDimensions: (
    pageNumber: number,
    scale?: number,
  ) => Promise<{ width: number; height: number }>;
}

/**
 * Options for the usePdfDocument hook
 */
export interface UsePdfDocumentOptions {
  /** Whether to extract text content from pages */
  extractText?: boolean;
  /** Callback when document is loaded */
  onLoad?: (metadata: PdfMetadata) => void;
  /** Callback when loading fails */
  onError?: (error: string) => void;
  /** Callback for loading progress */
  onProgress?: (progress: number) => void;
}

/**
 * Parse a PDF date string to a Date object
 */
function parsePdfDate(dateString: string | undefined): Date | undefined {
  if (!dateString) return undefined;

  // PDF dates are in format: D:YYYYMMDDHHmmss+HH'mm'
  const match = dateString.match(
    /D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
  );

  if (match && match.length >= 7) {
    const year = match[1]!;
    const month = match[2]!;
    const day = match[3]!;
    const hour = match[4]!;
    const minute = match[5]!;
    const second = match[6]!;
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10),
    );
  }

  return undefined;
}

/**
 * Custom hook for loading and managing PDF documents
 *
 * @param options - Configuration options for the hook
 * @returns Object containing document state and control functions
 *
 * @example
 * ```tsx
 * const { pdfDocument, loadFromFile, loadingState, metadata } = usePdfDocument({
 *   onLoad: (metadata) => console.log('Loaded:', metadata.title),
 *   onError: (error) => console.error('Failed:', error),
 * });
 *
 * // Load from file input
 * const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 *   const file = e.target.files?.[0];
 *   if (file) loadFromFile(file);
 * };
 * ```
 */
export function usePdfDocument(
  options: UsePdfDocumentOptions = {},
): UsePdfDocumentReturn {
  const { onLoad, onError, onProgress } = options;

  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [loadingState, setLoadingState] = useState<PdfLoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);

  // Keep track of the loading task for cancellation
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);

  /**
   * Clean up the current document
   */
  const closeDocument = useCallback(() => {
    const loadingTask = loadingTaskRef.current;
    const document = pdfDocumentRef.current;
    loadingTaskRef.current = null;
    pdfDocumentRef.current = null;
    if (document) void document.destroy();
    else if (loadingTask) void loadingTask.destroy();

    setPdfDocument(null);
    setMetadata(null);
    setLoadingState("idle");
    setError(null);
    setProgress(0);
  }, []);

  /**
   * Extract metadata from a loaded PDF document
   */
  const extractMetadata = useCallback(
    async (doc: PDFDocumentProxy): Promise<PdfMetadata> => {
      const info = await doc.getMetadata();
      const pdfInfo = info.info as Record<string, unknown>;
      const permissions =
        typeof doc.getPermissions === "function"
          ? await doc.getPermissions()
          : null;

      return {
        title: pdfInfo?.Title as string | undefined,
        author: pdfInfo?.Author as string | undefined,
        subject: pdfInfo?.Subject as string | undefined,
        keywords: pdfInfo?.Keywords as string | undefined,
        creator: pdfInfo?.Creator as string | undefined,
        producer: pdfInfo?.Producer as string | undefined,
        creationDate: parsePdfDate(pdfInfo?.CreationDate as string | undefined),
        modificationDate: parsePdfDate(pdfInfo?.ModDate as string | undefined),
        pdfVersion: info.metadata?.get("pdf:PDFVersion") ?? undefined,
        pageCount: doc.numPages,
        isEncrypted: permissions !== null,
      };
    },
    [],
  );

  /**
   * Internal function to load PDF from a source
   */
  const loadPdf = useCallback(
    async (source: string | ArrayBuffer | Uint8Array) => {
      // Clean up any existing document
      closeDocument();

      setLoadingState("loading");
      setError(null);
      setProgress(0);

      try {
        const workerData =
          typeof source === "string" ? undefined : source.slice();
        const loadingTask = pdfjsLib.getDocument({
          // PDF.js transfers this typed array to its worker. Always pass an
          // owned copy so StrictMode replays and sibling consumers can reuse
          // their original document bytes safely.
          data: workerData,
          url: typeof source === "string" ? source : undefined,
        });

        loadingTaskRef.current = loadingTask;

        // Track loading progress
        loadingTask.onProgress = (progressData: {
          loaded: number;
          total: number;
        }) => {
          if (progressData.total > 0) {
            const percent = Math.round(
              (progressData.loaded / progressData.total) * 100,
            );
            setProgress(percent);
            onProgress?.(percent);
          }
        };

        const doc = await loadingTask.promise;
        const extractedMetadata = await extractMetadata(doc);

        pdfDocumentRef.current = doc;
        setPdfDocument(doc);
        setMetadata(extractedMetadata);
        setLoadingState("loaded");
        setProgress(100);
        onProgress?.(100);

        onLoad?.(extractedMetadata);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load PDF";
        setError(errorMessage);
        setLoadingState("error");
        onError?.(errorMessage);
      }
    },
    [closeDocument, extractMetadata, onLoad, onError, onProgress],
  );

  /**
   * Load PDF from a File object
   */
  const loadFromFile = useCallback(
    async (file: File) => {
      if (
        !file.type.includes("pdf") &&
        !file.name.toLowerCase().endsWith(".pdf")
      ) {
        const errorMessage = "Invalid file type. Please select a PDF file.";
        setError(errorMessage);
        setLoadingState("error");
        onError?.(errorMessage);
        return;
      }

      try {
        const arrayBuffer =
          typeof file.arrayBuffer === "function"
            ? await file.arrayBuffer()
            : await new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = () =>
                  reject(reader.error ?? new Error("Failed to read file"));
                reader.readAsArrayBuffer(file);
              });
        await loadPdf(new Uint8Array(arrayBuffer));
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to read file";
        setError(errorMessage);
        setLoadingState("error");
        onError?.(errorMessage);
      }
    },
    [loadPdf, onError],
  );

  /**
   * Load PDF from an ArrayBuffer
   */
  const loadFromArrayBuffer = useCallback(
    async (buffer: ArrayBuffer) => {
      await loadPdf(new Uint8Array(buffer));
    },
    [loadPdf],
  );

  /**
   * Load PDF from a URL
   */
  const loadFromUrl = useCallback(
    async (url: string) => {
      await loadPdf(url);
    },
    [loadPdf],
  );

  /**
   * Render a specific page to a canvas element
   */
  const renderPage = useCallback(
    async (
      pageNumber: number,
      canvas: HTMLCanvasElement,
      scale: number = 1,
    ): Promise<{ width: number; height: number }> => {
      if (!pdfDocument) {
        throw new Error("No PDF document loaded");
      }

      if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
        throw new Error(
          `Page ${pageNumber} out of range (1-${pdfDocument.numPages})`,
        );
      }

      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Could not get canvas 2D context");
      }

      // Set canvas dimensions
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render the page
      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      return {
        width: viewport.width,
        height: viewport.height,
      };
    },
    [pdfDocument],
  );

  /**
   * Get the dimensions of a specific page
   */
  const getPageDimensions = useCallback(
    async (
      pageNumber: number,
      scale: number = 1,
    ): Promise<{ width: number; height: number }> => {
      if (!pdfDocument) {
        throw new Error("No PDF document loaded");
      }

      if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
        throw new Error(
          `Page ${pageNumber} out of range (1-${pdfDocument.numPages})`,
        );
      }

      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      return {
        width: viewport.width,
        height: viewport.height,
      };
    },
    [pdfDocument],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const loadingTask = loadingTaskRef.current;
      const document = pdfDocumentRef.current;
      loadingTaskRef.current = null;
      pdfDocumentRef.current = null;
      if (document) void document.destroy();
      else if (loadingTask) void loadingTask.destroy();
    };
  }, []);

  return {
    pdfDocument,
    loadingState,
    error,
    progress,
    metadata,
    loadFromFile,
    loadFromArrayBuffer,
    loadFromUrl,
    closeDocument,
    renderPage,
    getPageDimensions,
  };
}

export default usePdfDocument;
