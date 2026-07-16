/**
 * SearchReplacePage - Full page for text search and replace across PDF documents
 */

import * as React from 'react';
import { Upload, Search, FileText, Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchPanel } from '@/components/pdf/SearchPanel';
import { PdfViewer } from '@/components/pdf/PdfViewer';
import { usePdfDocument } from '@/hooks/usePdfDocument';
import { useTextSearch } from '@/hooks/useTextSearch';
import { cn } from '@/lib/utils';
import { downloadBlob, arrayBufferToBlob } from '@/lib/utils';
import { replaceText, highlightSearchResults } from '@pdflover/pdf-core';

/**
 * SearchReplacePage provides a full-page interface for searching and
 * replacing text in PDF documents with live preview.
 */
export function SearchReplacePage() {
  // PDF document state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [pdfData, setPdfData] = React.useState<ArrayBuffer | null>(null);
  const [modifiedPdfData, setModifiedPdfData] = React.useState<ArrayBuffer | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [showResultsList, setShowResultsList] = React.useState(true);

  // File input ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // PDF document hook
  const {
    pdfDocument,
    metadata,
    loadFromFile,
    loadFromArrayBuffer,
  } = usePdfDocument({
    onError: (err) => console.error('PDF load error:', err),
  });

  // Text search hook
  const search = useTextSearch({
    pdfDocument,
    debounceMs: 300,
    onReplace: async (searchQuery, replaceWith, results, replaceAll) => {
      if (!pdfData) return false;

      setIsProcessing(true);
      try {
        const result = await replaceText(
          pdfData,
          searchQuery,
          replaceWith,
          results,
          { replaceAll }
        );

        if (result.success && result.data) {
          setModifiedPdfData(result.data);
          // Reload the document with modified data
          await loadFromArrayBuffer(result.data);
          setPdfData(result.data);
          return true;
        }

        console.error('Replace failed:', result.error);
        return false;
      } catch (err) {
        console.error('Replace error:', err);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
  });

  /**
   * Handle file selection
   */
  const handleFileSelect = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setSelectedFile(file);
      setModifiedPdfData(null);
      search.clearSearch();

      // Store file data
      const buffer = await file.arrayBuffer();
      setPdfData(buffer);

      // Load into viewer
      loadFromFile(file);
    },
    [loadFromFile, search]
  );

  /**
   * Handle drag and drop
   */
  const handleDrop = React.useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        setSelectedFile(file);
        setModifiedPdfData(null);
        search.clearSearch();

        const buffer = await file.arrayBuffer();
        setPdfData(buffer);
        loadFromFile(file);
      }
    },
    [loadFromFile, search]
  );

  /**
   * Handle drag over
   */
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  /**
   * Download highlighted PDF
   */
  const handleDownloadHighlighted = React.useCallback(async () => {
    if (!pdfData || search.results.length === 0) return;

    setIsProcessing(true);
    try {
      const result = await highlightSearchResults(pdfData, search.results, {
        color: { r: 1, g: 1, b: 0 },
        opacity: 0.35,
      });

      if (result.success && result.data) {
        const blob = arrayBufferToBlob(result.data);
        const filename = selectedFile
          ? selectedFile.name.replace('.pdf', '_highlighted.pdf')
          : 'highlighted.pdf';
        downloadBlob(blob, filename);
      }
    } catch (err) {
      console.error('Highlight error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [pdfData, search.results, selectedFile]);

  /**
   * Download modified PDF
   */
  const handleDownload = React.useCallback(() => {
    const dataToDownload = modifiedPdfData || pdfData;
    if (!dataToDownload) return;

    const blob = arrayBufferToBlob(dataToDownload);
    const filename = selectedFile
      ? selectedFile.name.replace('.pdf', modifiedPdfData ? '_modified.pdf' : '.pdf')
      : 'document.pdf';
    downloadBlob(blob, filename);
  }, [pdfData, modifiedPdfData, selectedFile]);

  /**
   * Trigger file input click
   */
  const handleSelectClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Search & Replace Text
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Find and replace text in your PDF documents. All processing happens locally in your browser.
          </p>
        </div>

        {!selectedFile ? (
          /* Upload Area */
          <Card
            className={cn(
              'border-2 border-dashed transition-colors cursor-pointer',
              'hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-950/20'
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={handleSelectClick}
          >
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-primary-100 dark:bg-primary-900/30 p-4 mb-4">
                <Upload className="h-8 w-8 text-primary-500" />
              </div>
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
                Upload a PDF
              </h3>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-4 text-center max-w-md">
                Drag and drop a PDF file here, or click to select a file
              </p>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Select PDF
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </CardContent>
          </Card>
        ) : (
          /* Search and Preview Layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Search Panel Card */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Search className="h-5 w-5" />
                    Search & Replace
                  </CardTitle>
                  <CardDescription>
                    {metadata?.title || selectedFile.name}
                    {metadata?.pageCount && ` - ${metadata.pageCount} pages`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <SearchPanel
                    query={search.query}
                    onQueryChange={search.setQuery}
                    options={search.options}
                    onOptionsChange={search.setOptions}
                    results={search.results}
                    searchState={search.searchState}
                    error={search.error}
                    currentMatchIndex={search.currentMatchIndex}
                    matchCount={search.matchCount}
                    onNextMatch={search.nextMatch}
                    onPrevMatch={search.prevMatch}
                    onGoToMatch={search.goToMatch}
                    onClear={search.clearSearch}
                    replaceText={search.replaceText}
                    onReplaceTextChange={search.setReplaceText}
                    onReplaceCurrent={search.replaceCurrent}
                    onReplaceAll={search.replaceAll}
                    isReplacing={search.isReplacing}
                    showResultsList={showResultsList}
                    resultsMaxHeight={300}
                    className="border-0"
                  />
                </CardContent>

                {/* Actions */}
                <div className="p-4 border-t flex flex-col gap-2">
                  <Button
                    onClick={handleDownloadHighlighted}
                    disabled={search.results.length === 0 || isProcessing}
                    variant="outline"
                    className="w-full"
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download with Highlights
                  </Button>

                  <Button
                    onClick={handleDownload}
                    disabled={!pdfData}
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download {modifiedPdfData ? 'Modified ' : ''}PDF
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedFile(null);
                      setPdfData(null);
                      setModifiedPdfData(null);
                      search.clearSearch();
                    }}
                    className="w-full"
                  >
                    Upload Different PDF
                  </Button>
                </div>
              </Card>
            </div>

            {/* PDF Preview */}
            <div className="lg:col-span-2">
              <Card className="overflow-hidden">
                <CardHeader className="py-3 border-b">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Preview</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowResultsList(!showResultsList)}
                    >
                      {showResultsList ? 'Hide' : 'Show'} Results List
                    </Button>
                  </CardTitle>
                </CardHeader>
                <div className="h-[calc(100vh-280px)] min-h-[500px]">
                  <PdfViewer
                    file={selectedFile}
                    showToolbar={true}
                    showThumbnails={false}
                    enableSearch={false}
                    className="h-full"
                  />
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for Search & Replace
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Use "Match case" for case-sensitive searches (e.g., "PDF" vs "pdf")
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Use "Match whole word" to avoid partial matches (e.g., "the" won't match "there")
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Enable "Regular expression" for pattern matching (e.g., "\d+" matches numbers)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Press Ctrl+F to quickly open the search panel
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Text replacement may not preserve original formatting due to PDF structure limitations
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Replacement draws new visible text over the old content; it is not secure redaction and the original text may remain extractable
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              All processing happens locally - your files never leave your device
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default SearchReplacePage;
