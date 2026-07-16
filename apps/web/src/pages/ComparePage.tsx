/**
 * ComparePage - PDF Comparison Tool
 *
 * Allows users to compare two PDF documents side by side
 * with text and visual comparison capabilities.
 */

import { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  X,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileDropzone } from '@/components/file-manager/FileDropzone';
import { CompareViewer } from '@/components/compare/CompareViewer';
import { ComparisonSummary } from '@/components/compare/ComparisonSummary';
import { usePdfComparison } from '@/hooks/usePdfComparison';
import type { ComparisonMode } from '@/hooks/usePdfComparison';

/**
 * PDF file with metadata
 */
interface PdfFile {
  file: File;
  url: string;
  name: string;
}

/**
 * ComparePage Component
 *
 * Full page for PDF comparison functionality with:
 * - Drag-and-drop file upload
 * - Comparison mode selection (Text/Visual/Both)
 * - Side-by-side viewer with synchronized scrolling
 * - Difference highlighting and navigation
 * - Summary statistics and report export
 */
export function ComparePage() {
  const [pdf1, setPdf1] = useState<PdfFile | null>(null);
  const [pdf2, setPdf2] = useState<PdfFile | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const {
    state,
    progress,
    result,
    error,
    mode,
    setMode,
    compare,
    currentDifferenceIndex,
    nextDifference,
    prevDifference,
    reset,
  } = usePdfComparison({
    defaultMode: 'text',
    onError: (err) => {
      console.error('Comparison error:', err);
    },
  });

  /**
   * Handle file drop for PDF 1
   */
  const handlePdf1Drop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file || !file.type.includes('pdf')) return;

    // Revoke previous URL
    if (pdf1?.url) {
      URL.revokeObjectURL(pdf1.url);
    }

    const url = URL.createObjectURL(file);
    setPdf1({ file, url, name: file.name });
    reset();
  }, [pdf1, reset]);

  /**
   * Handle file drop for PDF 2
   */
  const handlePdf2Drop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file || !file.type.includes('pdf')) return;

    // Revoke previous URL
    if (pdf2?.url) {
      URL.revokeObjectURL(pdf2.url);
    }

    const url = URL.createObjectURL(file);
    setPdf2({ file, url, name: file.name });
    reset();
  }, [pdf2, reset]);

  /**
   * Remove PDF 1
   */
  const removePdf1 = useCallback(() => {
    if (pdf1?.url) {
      URL.revokeObjectURL(pdf1.url);
    }
    setPdf1(null);
    reset();
  }, [pdf1, reset]);

  /**
   * Remove PDF 2
   */
  const removePdf2 = useCallback(() => {
    if (pdf2?.url) {
      URL.revokeObjectURL(pdf2.url);
    }
    setPdf2(null);
    reset();
  }, [pdf2, reset]);

  /**
   * Start comparison
   */
  const handleCompare = useCallback(async () => {
    if (!pdf1 || !pdf2) return;
    await compare(pdf1.file, pdf2.file);
  }, [pdf1, pdf2, compare]);

  /**
   * Handle mode change
   */
  const handleModeChange = useCallback((newMode: string) => {
    setMode(newMode as ComparisonMode);
    reset();
  }, [setMode, reset]);

  /**
   * Handle difference navigation
   */
  const handleDifferenceNavigate = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      prevDifference();
    } else {
      nextDifference();
    }
  }, [prevDifference, nextDifference]);

  /**
   * Navigate to a specific page from summary
   */
  const handlePageClick = useCallback((pageNum: number) => {
    setCurrentPage(pageNum);
  }, []);

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Check if both PDFs are loaded
   */
  const canCompare = pdf1 !== null && pdf2 !== null && state !== 'comparing';

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white mb-2">
            Compare PDF Files
          </h1>
          <p className="text-surface-600 dark:text-surface-400">
            Upload two PDF files to compare them side by side. Find text changes, layout differences, and more.
            All processing happens locally in your browser.
          </p>
        </div>

        {/* File upload section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* PDF 1 Upload */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
                Original PDF
              </h3>
              {pdf1 ? (
                <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                      <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <p className="font-medium text-surface-900 dark:text-white truncate max-w-[200px]">
                        {pdf1.name}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        {formatFileSize(pdf1.file.size)}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={removePdf1}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <FileDropzone
                  onFilesAccepted={handlePdf1Drop}
                  accept={{ 'application/pdf': ['.pdf'] }}
                  maxFiles={1}
                  className="h-32"
                >
                  <div className="flex flex-col items-center justify-center text-center">
                    <Upload className="h-8 w-8 text-surface-400 dark:text-surface-500 mb-2" />
                    <p className="text-sm text-surface-600 dark:text-surface-400">
                      Drop PDF here or click to browse
                    </p>
                  </div>
                </FileDropzone>
              )}
            </CardContent>
          </Card>

          {/* PDF 2 Upload */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
                Modified PDF
              </h3>
              {pdf2 ? (
                <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                      <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <p className="font-medium text-surface-900 dark:text-white truncate max-w-[200px]">
                        {pdf2.name}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        {formatFileSize(pdf2.file.size)}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={removePdf2}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <FileDropzone
                  onFilesAccepted={handlePdf2Drop}
                  accept={{ 'application/pdf': ['.pdf'] }}
                  maxFiles={1}
                  className="h-32"
                >
                  <div className="flex flex-col items-center justify-center text-center">
                    <Upload className="h-8 w-8 text-surface-400 dark:text-surface-500 mb-2" />
                    <p className="text-sm text-surface-600 dark:text-surface-400">
                      Drop PDF here or click to browse
                    </p>
                  </div>
                </FileDropzone>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Comparison options and actions */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Mode selection */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Comparison Mode:
                </span>
                <Tabs value={mode} onValueChange={handleModeChange}>
                  <TabsList>
                    <TabsTrigger value="text">Text Only</TabsTrigger>
                    <TabsTrigger value="visual">Visual Only</TabsTrigger>
                    <TabsTrigger value="both">Both</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Compare button */}
              <Button
                onClick={handleCompare}
                disabled={!canCompare}
                size="lg"
                className="w-full sm:w-auto"
              >
                {state === 'comparing' ? (
                  <>
                    <span className="animate-spin mr-2">
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    </span>
                    Comparing...
                  </>
                ) : (
                  'Compare PDFs'
                )}
              </Button>
            </div>

            {/* Progress bar */}
            {state === 'comparing' && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-600 dark:text-surface-400">
                    {progress.stage}
                  </span>
                  <span className="text-surface-600 dark:text-surface-400">
                    {progress.percentage}%
                  </span>
                </div>
                <Progress value={progress.percentage} />
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">
                    Comparison failed
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                    {error}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results section */}
        {(result || state === 'comparing') && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Comparison viewer */}
            <div className="xl:col-span-2">
              <Card className="h-[600px]">
                <CompareViewer
                  pdf1Url={pdf1?.url ?? null}
                  pdf2Url={pdf2?.url ?? null}
                  pdf1Name={pdf1?.name}
                  pdf2Name={pdf2?.name}
                  comparisonResult={result}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  currentDifferenceIndex={currentDifferenceIndex}
                  onDifferenceNavigate={handleDifferenceNavigate}
                  className="h-full"
                />
              </Card>
            </div>

            {/* Summary panel */}
            <div className="xl:col-span-1">
              <ComparisonSummary
                result={result}
                isLoading={state === 'comparing'}
                pdf1Name={pdf1?.name}
                pdf2Name={pdf2?.name}
                onPageClick={handlePageClick}
              />
            </div>
          </div>
        )}

        {/* Tips Section */}
        <div className="mt-8 p-6 bg-card dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">
            Tips for comparing PDFs
          </h2>
          <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Text mode compares the text content of both PDFs line by line
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Visual mode compares PDFs pixel by pixel to detect any visual changes
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Use the difference navigation buttons to jump between changes
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">-</span>
              Download the comparison report to share results with others
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
