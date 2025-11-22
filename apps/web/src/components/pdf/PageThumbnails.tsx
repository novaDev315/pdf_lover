/**
 * PageThumbnails Component
 * Sidebar component displaying page thumbnails for navigation and reordering
 */

import * as React from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { cn } from '@/lib/utils';

/**
 * Thumbnail data for a single page
 */
interface ThumbnailData {
  pageNumber: number;
  dataUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Props for the PageThumbnails component
 */
export interface PageThumbnailsProps {
  /** PDF document proxy from PDF.js */
  pdfDocument: PDFDocumentProxy | null;
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Maximum thumbnail width in pixels */
  thumbnailWidth?: number;
  /** Whether drag-and-drop reordering is enabled */
  enableReorder?: boolean;
  /** Callback when a page thumbnail is clicked */
  onPageSelect: (pageNumber: number) => void;
  /** Callback when pages are reordered via drag-and-drop */
  onReorder?: (newOrder: number[]) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Individual thumbnail component
 */
interface ThumbnailItemProps {
  pageNumber: number;
  thumbnail: ThumbnailData;
  isSelected: boolean;
  enableReorder: boolean;
  onSelect: () => void;
  onDragStart?: (e: React.DragEvent, pageNumber: number) => void;
  onDragOver?: (e: React.DragEvent, pageNumber: number) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent, pageNumber: number) => void;
}

function ThumbnailItem({
  pageNumber,
  thumbnail,
  isSelected,
  enableReorder,
  onSelect,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: ThumbnailItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'group relative flex flex-col items-center rounded-lg p-2 transition-colors',
        'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        isSelected && 'bg-accent ring-2 ring-primary'
      )}
      onClick={onSelect}
      draggable={enableReorder}
      onDragStart={(e) => onDragStart?.(e, pageNumber)}
      onDragOver={(e) => onDragOver?.(e, pageNumber)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop?.(e, pageNumber)}
      aria-label={`Page ${pageNumber}`}
      aria-current={isSelected ? 'page' : undefined}
    >
      {/* Thumbnail Container */}
      <div
        className={cn(
          'relative overflow-hidden rounded border bg-white shadow-sm',
          'transition-shadow group-hover:shadow-md',
          isSelected && 'border-primary'
        )}
      >
        {thumbnail.isLoading ? (
          // Loading state
          <div className="flex h-32 w-24 items-center justify-center bg-muted">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : thumbnail.error ? (
          // Error state
          <div className="flex h-32 w-24 items-center justify-center bg-muted text-muted-foreground">
            <span className="text-xs">Error</span>
          </div>
        ) : thumbnail.dataUrl ? (
          // Loaded thumbnail
          <img
            src={thumbnail.dataUrl}
            alt={`Page ${pageNumber} thumbnail`}
            className="h-auto w-24 object-contain"
            loading="lazy"
          />
        ) : (
          // Placeholder
          <div className="flex h-32 w-24 items-center justify-center bg-muted">
            <span className="text-2xl font-medium text-muted-foreground">
              {pageNumber}
            </span>
          </div>
        )}
      </div>

      {/* Page Number */}
      <span
        className={cn(
          'mt-1.5 text-xs font-medium',
          isSelected ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {pageNumber}
      </span>

      {/* Drag Handle Indicator (shown on hover when reorder enabled) */}
      {enableReorder && (
        <div
          className={cn(
            'absolute left-1/2 top-1 -translate-x-1/2 opacity-0 transition-opacity',
            'group-hover:opacity-100'
          )}
        >
          <div className="flex gap-0.5">
            <div className="h-1 w-1 rounded-full bg-muted-foreground" />
            <div className="h-1 w-1 rounded-full bg-muted-foreground" />
            <div className="h-1 w-1 rounded-full bg-muted-foreground" />
          </div>
        </div>
      )}
    </button>
  );
}

/**
 * PageThumbnails component displays a scrollable sidebar of page thumbnails
 * that can be used for navigation and optionally reordering pages.
 *
 * @example
 * ```tsx
 * <PageThumbnails
 *   pdfDocument={pdfDocument}
 *   currentPage={1}
 *   onPageSelect={setCurrentPage}
 *   enableReorder={true}
 *   onReorder={handleReorder}
 * />
 * ```
 */
export function PageThumbnails({
  pdfDocument,
  currentPage,
  thumbnailWidth = 96,
  enableReorder = false,
  onPageSelect,
  onReorder,
  className,
}: PageThumbnailsProps) {
  const [thumbnails, setThumbnails] = React.useState<Map<number, ThumbnailData>>(
    new Map()
  );
  const [pageOrder, setPageOrder] = React.useState<number[]>([]);
  const [draggedPage, setDraggedPage] = React.useState<number | null>(null);
  const [dragOverPage, setDragOverPage] = React.useState<number | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const thumbnailRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());

  // Initialize page order when document changes
  React.useEffect(() => {
    if (pdfDocument) {
      const order = Array.from({ length: pdfDocument.numPages }, (_, i) => i + 1);
      setPageOrder(order);
      setThumbnails(new Map());
    }
  }, [pdfDocument]);

  // Generate thumbnail for a specific page
  const generateThumbnail = React.useCallback(
    async (pageNumber: number) => {
      if (!pdfDocument) return;

      // Mark as loading
      setThumbnails((prev) => {
        const next = new Map(prev);
        next.set(pageNumber, {
          pageNumber,
          dataUrl: null,
          isLoading: true,
          error: null,
        });
        return next;
      });

      try {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const scale = thumbnailWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        // Create canvas for rendering
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get canvas context');

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        const dataUrl = canvas.toDataURL('image/png');

        setThumbnails((prev) => {
          const next = new Map(prev);
          next.set(pageNumber, {
            pageNumber,
            dataUrl,
            isLoading: false,
            error: null,
          });
          return next;
        });
      } catch (err) {
        setThumbnails((prev) => {
          const next = new Map(prev);
          next.set(pageNumber, {
            pageNumber,
            dataUrl: null,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to load',
          });
          return next;
        });
      }
    },
    [pdfDocument, thumbnailWidth]
  );

  // Set up intersection observer for lazy loading
  React.useEffect(() => {
    if (!pdfDocument) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNumber = parseInt(
              entry.target.getAttribute('data-page') || '0',
              10
            );
            if (pageNumber > 0 && !thumbnails.has(pageNumber)) {
              generateThumbnail(pageNumber);
            }
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: '100px',
        threshold: 0,
      }
    );

    // Observe all thumbnail placeholders
    thumbnailRefs.current.forEach((element) => {
      observerRef.current?.observe(element);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [pdfDocument, thumbnails, generateThumbnail]);

  // Scroll current page into view
  React.useEffect(() => {
    const element = thumbnailRefs.current.get(currentPage);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentPage]);

  // Drag and drop handlers
  const handleDragStart = React.useCallback(
    (e: React.DragEvent, pageNumber: number) => {
      setDraggedPage(pageNumber);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(pageNumber));
    },
    []
  );

  const handleDragOver = React.useCallback(
    (e: React.DragEvent, pageNumber: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverPage(pageNumber);
    },
    []
  );

  const handleDragEnd = React.useCallback(() => {
    setDraggedPage(null);
    setDragOverPage(null);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent, targetPage: number) => {
      e.preventDefault();
      const sourcePage = draggedPage;

      if (sourcePage && sourcePage !== targetPage) {
        setPageOrder((prev) => {
          const newOrder = [...prev];
          const sourceIndex = newOrder.indexOf(sourcePage);
          const targetIndex = newOrder.indexOf(targetPage);

          if (sourceIndex !== -1 && targetIndex !== -1) {
            newOrder.splice(sourceIndex, 1);
            newOrder.splice(targetIndex, 0, sourcePage);
          }

          onReorder?.(newOrder);
          return newOrder;
        });
      }

      setDraggedPage(null);
      setDragOverPage(null);
    },
    [draggedPage, onReorder]
  );

  if (!pdfDocument) {
    return (
      <div
        className={cn(
          'flex w-36 flex-col items-center justify-center bg-muted/50 p-4',
          className
        )}
      >
        <span className="text-sm text-muted-foreground">No document loaded</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex w-36 flex-col overflow-y-auto border-r bg-muted/30',
        className
      )}
      role="listbox"
      aria-label="Page thumbnails"
    >
      <div className="flex flex-col items-center gap-2 p-2">
        {pageOrder.map((pageNumber) => {
          const thumbnail = thumbnails.get(pageNumber) || {
            pageNumber,
            dataUrl: null,
            isLoading: false,
            error: null,
          };

          return (
            <div
              key={pageNumber}
              ref={(el) => {
                if (el) {
                  thumbnailRefs.current.set(pageNumber, el);
                } else {
                  thumbnailRefs.current.delete(pageNumber);
                }
              }}
              data-page={pageNumber}
              className={cn(
                'transition-transform',
                draggedPage === pageNumber && 'opacity-50',
                dragOverPage === pageNumber &&
                  draggedPage !== pageNumber &&
                  'translate-y-1 border-t-2 border-primary'
              )}
            >
              <ThumbnailItem
                pageNumber={pageNumber}
                thumbnail={thumbnail}
                isSelected={pageNumber === currentPage}
                enableReorder={enableReorder}
                onSelect={() => onPageSelect(pageNumber)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

PageThumbnails.displayName = 'PageThumbnails';

export default PageThumbnails;
