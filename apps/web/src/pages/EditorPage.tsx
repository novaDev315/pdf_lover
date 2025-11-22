/**
 * EditorPage - Full PDF Editor Page
 * Provides a complete PDF editing experience with annotations, shapes, and forms
 */

import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Heart,
  Save,
  Download,
  Upload,
  FileText,
  ChevronLeft,
  ChevronRight,
  Layers,
  Settings,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { downloadBlob, arrayBufferToBlob } from '@/lib/utils';
import { usePdfDocument, type PdfMetadata } from '@/hooks/usePdfDocument';
import { PdfViewer } from '@/components/pdf/PdfViewer';
import { AnnotationLayer } from '@/components/pdf/AnnotationLayer';
import { AnnotationToolbar } from '@/components/pdf/AnnotationToolbar';
import { TextEditor, type TextEditorData } from '@/components/pdf/TextEditor';
import {
  useAnnotationStore,
  selectSelectedAnnotation,
  type Annotation,
  type TextAnnotation,
  type NoteAnnotation,
} from '@/store/annotation-store';
import {
  addTextAnnotation,
  addHighlight,
  addUnderline,
  addStrikethrough,
  addFreehandDrawing,
  addShape,
  flattenForm,
} from '@pdflover/pdf-core';
import { redactArea, applyRedactions } from '@pdflover/pdf-core';

/**
 * Page dimensions interface
 */
interface PageDimensions {
  width: number;
  height: number;
}

/**
 * EditorPage component
 * Full PDF editor with annotation, drawing, and form capabilities
 */
export function EditorPage() {
  const [searchParams] = useSearchParams();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // PDF document state
  const {
    pdfDocument,
    loadingState,
    error,
    progress,
    metadata,
    loadFromFile,
    loadFromArrayBuffer,
  } = usePdfDocument({
    onError: (err) => console.error('PDF load error:', err),
  });

  // Local state
  const [pdfData, setPdfData] = React.useState<ArrayBuffer | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(0);
  const [zoom, setZoom] = React.useState(1.0);
  const [pageDimensions, setPageDimensions] = React.useState<PageDimensions>({ width: 0, height: 0 });
  const [showThumbnails, setShowThumbnails] = React.useState(true);
  const [showProperties, setShowProperties] = React.useState(false);
  const [fileName, setFileName] = React.useState('document.pdf');
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [editingTextAnnotation, setEditingTextAnnotation] = React.useState<Annotation | null>(null);

  // Annotation store
  const {
    annotations,
    selectedAnnotationId,
    currentTool,
    hasUnsavedChanges,
    selectAnnotation,
    updateAnnotation,
    getAnnotationsForPage,
    loadAnnotations,
    clearAnnotations,
  } = useAnnotationStore();

  const selectedAnnotation = useAnnotationStore(selectSelectedAnnotation);

  // Update total pages when PDF loads
  React.useEffect(() => {
    if (pdfDocument) {
      setTotalPages(pdfDocument.numPages);
    }
  }, [pdfDocument]);

  // Get page dimensions
  React.useEffect(() => {
    if (pdfDocument && currentPage > 0) {
      pdfDocument.getPage(currentPage).then((page) => {
        const viewport = page.getViewport({ scale: 1 });
        setPageDimensions({
          width: viewport.width,
          height: viewport.height,
        });
      });
    }
  }, [pdfDocument, currentPage]);

  // Handle file selection
  const handleFileSelect = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const buffer = await file.arrayBuffer();
        setPdfData(buffer);
        setFileName(file.name);
        loadFromArrayBuffer(buffer);
        clearAnnotations();
        setCurrentPage(1);
      } catch (err) {
        console.error('Failed to load file:', err);
      }
    },
    [loadFromArrayBuffer, clearAnnotations]
  );

  // Handle file drop
  const handleDrop = React.useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.name.toLowerCase().endsWith('.pdf')) return;

      try {
        const buffer = await file.arrayBuffer();
        setPdfData(buffer);
        setFileName(file.name);
        loadFromArrayBuffer(buffer);
        clearAnnotations();
        setCurrentPage(1);
      } catch (err) {
        console.error('Failed to load dropped file:', err);
      }
    },
    [loadFromArrayBuffer, clearAnnotations]
  );

  // Handle annotation click
  const handleAnnotationClick = React.useCallback((annotation: Annotation) => {
    selectAnnotation(annotation.id);
  }, [selectAnnotation]);

  // Handle annotation double-click (for editing text/notes)
  const handleAnnotationDoubleClick = React.useCallback((annotation: Annotation) => {
    if (annotation.type === 'text' || annotation.type === 'note') {
      setEditingTextAnnotation(annotation);
    }
  }, []);

  // Handle text editor confirm
  const handleTextEditorConfirm = React.useCallback(
    (data: TextEditorData) => {
      if (!editingTextAnnotation) return;

      if (editingTextAnnotation.type === 'text') {
        updateAnnotation(editingTextAnnotation.id, {
          content: data.content,
          fontSize: data.fontSize,
          fontFamily: data.fontFamily,
          bold: data.bold,
          italic: data.italic,
        } as Partial<TextAnnotation>);
      } else if (editingTextAnnotation.type === 'note') {
        updateAnnotation(editingTextAnnotation.id, {
          title: data.title ?? 'Note',
          content: data.content,
        } as Partial<NoteAnnotation>);
      }

      setEditingTextAnnotation(null);
    },
    [editingTextAnnotation, updateAnnotation]
  );

  // Handle text editor cancel
  const handleTextEditorCancel = React.useCallback(() => {
    setEditingTextAnnotation(null);
  }, []);

  // Export PDF with annotations
  const handleExport = React.useCallback(async () => {
    if (!pdfData) return;

    setIsSaving(true);
    try {
      let modifiedPdf = pdfData;

      // Apply annotations to PDF
      for (const annotation of annotations) {
        switch (annotation.type) {
          case 'highlight': {
            const result = await addHighlight(
              modifiedPdf,
              annotation.pageNum,
              annotation.rect,
              annotation.color
            );
            if (result.success && result.data) {
              modifiedPdf = result.data;
            }
            break;
          }
          case 'underline': {
            const result = await addUnderline(
              modifiedPdf,
              annotation.pageNum,
              annotation.rect,
              { color: annotation.color, opacity: annotation.opacity }
            );
            if (result.success && result.data) {
              modifiedPdf = result.data;
            }
            break;
          }
          case 'strikethrough': {
            const result = await addStrikethrough(
              modifiedPdf,
              annotation.pageNum,
              annotation.rect,
              { color: annotation.color, opacity: annotation.opacity }
            );
            if (result.success && result.data) {
              modifiedPdf = result.data;
            }
            break;
          }
          case 'text': {
            const textAnnot = annotation as TextAnnotation;
            const result = await addTextAnnotation(modifiedPdf, {
              pageNum: annotation.pageNum,
              x: annotation.rect.x,
              y: annotation.rect.y,
              content: textAnnot.content,
              color: annotation.color,
              fontSize: textAnnot.fontSize,
              fontFamily: textAnnot.fontFamily,
              isNote: false,
            });
            if (result.success && result.data) {
              modifiedPdf = result.data;
            }
            break;
          }
          case 'note': {
            const noteAnnot = annotation as NoteAnnotation;
            const result = await addTextAnnotation(modifiedPdf, {
              pageNum: annotation.pageNum,
              x: annotation.rect.x,
              y: annotation.rect.y,
              content: noteAnnot.content,
              title: noteAnnot.title,
              color: annotation.color,
              isNote: true,
            });
            if (result.success && result.data) {
              modifiedPdf = result.data;
            }
            break;
          }
          case 'freehand': {
            const freehandAnnot = annotation as typeof annotation & { paths: { x: number; y: number }[][] };
            const result = await addFreehandDrawing(
              modifiedPdf,
              annotation.pageNum,
              freehandAnnot.paths,
              {
                color: annotation.color,
                strokeWidth: freehandAnnot.strokeWidth,
                opacity: annotation.opacity,
              }
            );
            if (result.success && result.data) {
              modifiedPdf = result.data;
            }
            break;
          }
          case 'rectangle':
          case 'circle':
          case 'ellipse': {
            const shapeAnnot = annotation as typeof annotation & {
              strokeColor: { r: number; g: number; b: number };
              strokeWidth: number;
              filled: boolean;
              fillColor: { r: number; g: number; b: number };
            };
            const result = await addShape(
              modifiedPdf,
              annotation.pageNum,
              annotation.type,
              annotation.rect,
              {
                strokeColor: shapeAnnot.strokeColor,
                strokeWidth: shapeAnnot.strokeWidth,
                filled: shapeAnnot.filled,
                fillColor: shapeAnnot.fillColor,
                opacity: annotation.opacity,
              }
            );
            if (result.success && result.data) {
              modifiedPdf = result.data;
            }
            break;
          }
          case 'line':
          case 'arrow': {
            const lineAnnot = annotation as typeof annotation & {
              startPoint: { x: number; y: number };
              endPoint: { x: number; y: number };
            };
            const result = await addShape(
              modifiedPdf,
              annotation.pageNum,
              annotation.type,
              annotation.rect,
              {
                strokeColor: annotation.color,
                strokeWidth: (annotation as { strokeWidth?: number }).strokeWidth ?? 2,
                opacity: annotation.opacity,
              }
            );
            if (result.success && result.data) {
              modifiedPdf = result.data;
            }
            break;
          }
          case 'redaction': {
            const redactAnnot = annotation as typeof annotation & { applied: boolean };
            if (!redactAnnot.applied) {
              const result = await redactArea(
                modifiedPdf,
                annotation.pageNum,
                annotation.rect,
                { fillColor: { r: 0, g: 0, b: 0 } }
              );
              if (result.success && result.data) {
                modifiedPdf = result.data;
              }
            }
            break;
          }
        }
      }

      // Download the modified PDF
      const blob = arrayBufferToBlob(modifiedPdf);
      const exportName = fileName.replace('.pdf', '_annotated.pdf');
      downloadBlob(blob, exportName);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [pdfData, annotations, fileName]);

  // Handle save to IndexedDB (placeholder)
  const handleSave = React.useCallback(async () => {
    setShowSaveDialog(true);
  }, []);

  // Page navigation
  const goToPreviousPage = React.useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  const goToNextPage = React.useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages]);

  // Render empty state
  if (!pdfDocument && loadingState === 'idle') {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
        {/* Header */}
        <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 sticky top-0 z-10">
          <div className="max-w-full mx-auto px-4">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                  <Link to="/">
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                </Button>
                <div className="flex items-center gap-2">
                  <Heart className="h-6 w-6 text-primary-500" fill="currentColor" />
                  <span className="text-lg font-bold text-surface-900 dark:text-white">
                    PDF Editor
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Drop Zone */}
        <main className="flex items-center justify-center p-8" style={{ height: 'calc(100vh - 56px)' }}>
          <div
            className={cn(
              'w-full max-w-2xl p-12 border-2 border-dashed rounded-xl',
              'border-surface-300 dark:border-surface-700',
              'bg-white dark:bg-surface-900',
              'flex flex-col items-center justify-center gap-6',
              'cursor-pointer hover:border-primary-500 transition-colors'
            )}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <FileText className="h-16 w-16 text-surface-400" />
            <div className="text-center">
              <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-2">
                Open a PDF to Edit
              </h2>
              <p className="text-surface-600 dark:text-surface-400">
                Drag and drop a PDF file here, or click to browse
              </p>
            </div>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Select PDF
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </main>
      </div>
    );
  }

  // Render loading state
  if (loadingState === 'loading') {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="text-sm text-muted-foreground">Loading PDF... {progress}%</div>
        </div>
      </div>
    );
  }

  // Render error state
  if (loadingState === 'error' || error) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <div className="text-destructive text-lg font-medium">Failed to load PDF</div>
          <div className="text-muted-foreground">{error}</div>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Try Another File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 sticky top-0 z-20">
        <div className="px-4">
          <div className="flex items-center justify-between h-14">
            {/* Left Section */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary-500" fill="currentColor" />
                <span className="font-medium text-surface-900 dark:text-white truncate max-w-48">
                  {fileName}
                </span>
                {hasUnsavedChanges && (
                  <span className="text-xs text-muted-foreground">*</span>
                )}
              </div>
            </div>

            {/* Center Section - Page Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPreviousPage}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page);
                    }
                  }}
                  className="w-12 h-8 text-center"
                  min={1}
                  max={totalPages}
                />
                <span className="text-sm text-muted-foreground">/ {totalPages}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowThumbnails(!showThumbnails)}
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Thumbnails</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowProperties(!showProperties)}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Properties</TooltipContent>
              </Tooltip>

              <div className="h-6 w-px bg-border mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleSave}>
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save (Ctrl+S)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleExport}
                    disabled={isSaving || annotations.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export with annotations</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </header>

      {/* Annotation Toolbar */}
      <div className="bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 px-4 py-2">
        <AnnotationToolbar />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Thumbnails Sidebar */}
        {showThumbnails && (
          <aside className="w-48 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 overflow-y-auto">
            <div className="p-2 space-y-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  className={cn(
                    'w-full p-2 rounded border transition-colors',
                    pageNum === currentPage
                      ? 'border-primary bg-primary/10'
                      : 'border-surface-200 dark:border-surface-700 hover:border-primary/50'
                  )}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  <div className="text-xs text-center text-muted-foreground">
                    Page {pageNum}
                  </div>
                  {getAnnotationsForPage(pageNum).length > 0 && (
                    <div className="text-xs text-center text-primary mt-1">
                      {getAnnotationsForPage(pageNum).length} annotations
                    </div>
                  )}
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* PDF Viewer Area */}
        <div className="flex-1 overflow-auto bg-surface-100 dark:bg-surface-950 relative">
          <div className="flex justify-center p-4">
            <div
              className="relative bg-white shadow-lg"
              style={{
                width: pageDimensions.width * zoom,
                height: pageDimensions.height * zoom,
              }}
            >
              {/* PDF Page Canvas would render here */}
              {pdfDocument && (
                <div className="absolute inset-0">
                  {/* This would be the actual PDF page rendering */}
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    Page {currentPage}
                  </div>
                </div>
              )}

              {/* Annotation Layer */}
              <AnnotationLayer
                pageNum={currentPage}
                width={pageDimensions.width * zoom}
                height={pageDimensions.height * zoom}
                scale={zoom}
                editable={true}
                onAnnotationClick={handleAnnotationClick}
                onAnnotationDoubleClick={handleAnnotationDoubleClick}
              />

              {/* Text Editor Overlay */}
              {editingTextAnnotation && (
                <TextEditor
                  type={editingTextAnnotation.type as 'text' | 'note'}
                  initialContent={
                    editingTextAnnotation.type === 'text'
                      ? (editingTextAnnotation as TextAnnotation).content
                      : (editingTextAnnotation as NoteAnnotation).content
                  }
                  initialTitle={
                    editingTextAnnotation.type === 'note'
                      ? (editingTextAnnotation as NoteAnnotation).title
                      : undefined
                  }
                  fontSize={
                    editingTextAnnotation.type === 'text'
                      ? (editingTextAnnotation as TextAnnotation).fontSize
                      : 14
                  }
                  fontFamily={
                    editingTextAnnotation.type === 'text'
                      ? (editingTextAnnotation as TextAnnotation).fontFamily
                      : 'Helvetica'
                  }
                  color={editingTextAnnotation.color}
                  rect={editingTextAnnotation.rect}
                  scale={zoom}
                  onConfirm={handleTextEditorConfirm}
                  onCancel={handleTextEditorCancel}
                />
              )}
            </div>
          </div>
        </div>

        {/* Properties Panel */}
        {showProperties && selectedAnnotation && (
          <aside className="w-64 bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-800 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-medium mb-4">Annotation Properties</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-muted-foreground">Type</label>
                  <div className="capitalize">{selectedAnnotation.type}</div>
                </div>
                <div>
                  <label className="text-muted-foreground">Page</label>
                  <div>{selectedAnnotation.pageNum}</div>
                </div>
                <div>
                  <label className="text-muted-foreground">Position</label>
                  <div>
                    X: {Math.round(selectedAnnotation.rect.x)}, Y: {Math.round(selectedAnnotation.rect.y)}
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground">Size</label>
                  <div>
                    {Math.round(selectedAnnotation.rect.width)} x {Math.round(selectedAnnotation.rect.height)}
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground">Created</label>
                  <div>{new Date(selectedAnnotation.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <label className="text-muted-foreground">Modified</label>
                  <div>{new Date(selectedAnnotation.updatedAt).toLocaleString()}</div>
                </div>
                {selectedAnnotation.locked && (
                  <div className="text-warning">Locked</div>
                )}
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Document</DialogTitle>
            <DialogDescription>
              Save your annotated document to continue editing later.
              Annotations are stored locally in your browser.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm text-muted-foreground">Document Name</label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Save to IndexedDB would go here
                setShowSaveDialog(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

export default EditorPage;
