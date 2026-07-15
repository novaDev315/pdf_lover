/**
 * ComparisonSummary Component
 *
 * Displays summary statistics from PDF comparison including
 * pages changed, text changes, and similarity percentages.
 * Supports downloading the comparison report.
 */

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Download,
  FileText,
  Layout,
  Plus,
  Minus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

/**
 * Re-define types locally to avoid build dependency issues
 * These mirror the types from @pdflover/pdf-core
 */
export type DifferenceType = 'text' | 'image' | 'layout' | 'addition' | 'deletion' | 'modification';

export interface Difference {
  type: DifferenceType;
  pageNumber: number;
  location: { x: number; y: number; width: number; height: number };
  oldValue: string | null;
  newValue: string | null;
  description?: string;
}

export interface LineDiff {
  originalLine: number | null;
  modifiedLine: number | null;
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  originalText?: string;
  modifiedText?: string;
  pageNumber: number;
}

export interface PageComparison {
  pageNum: number;
  differences: Difference[];
  similarity: number;
  textSimilarity: number;
  visualSimilarity?: number;
  sameDimensions: boolean;
  diffImageDataUrl?: string;
}

export interface ComparisonSummaryData {
  pdf1PageCount: number;
  pdf2PageCount: number;
  pagesChanged: number;
  pagesIdentical: number;
  textChanges: number;
  textAdditions: number;
  textDeletions: number;
  textModifications: number;
  overallSimilarity: number;
  visualSimilarity?: number;
  duration: number;
}

export interface ComparisonResult {
  pages: PageComparison[];
  summary: ComparisonSummaryData;
  textDiff?: LineDiff[];
}

/**
 * Generate a human-readable diff report
 */
function generateDiffReport(result: ComparisonResult): string {
  const { summary, pages } = result;
  const lines: string[] = [];

  lines.push('PDF Comparison Report');
  lines.push('=====================');
  lines.push('');
  lines.push('Summary');
  lines.push('-------');
  lines.push(`PDF 1 Pages: ${summary.pdf1PageCount}`);
  lines.push(`PDF 2 Pages: ${summary.pdf2PageCount}`);
  lines.push(`Overall Similarity: ${summary.overallSimilarity}%`);
  lines.push('');
  lines.push(`Pages Changed: ${summary.pagesChanged}`);
  lines.push(`Pages Identical: ${summary.pagesIdentical}`);
  lines.push('');

  if (summary.textChanges > 0) {
    lines.push('Text Changes');
    lines.push('------------');
    lines.push(`Additions: ${summary.textAdditions}`);
    lines.push(`Deletions: ${summary.textDeletions}`);
    lines.push(`Modifications: ${summary.textModifications}`);
    lines.push('');
  }

  lines.push('Page Details');
  lines.push('------------');
  for (const page of pages) {
    if (page.differences.length > 0) {
      lines.push(`\nPage ${page.pageNum} (${page.similarity}% similar):`);
      for (const diff of page.differences) {
        const typeLabel = diff.type.charAt(0).toUpperCase() + diff.type.slice(1);
        lines.push(`  - ${typeLabel}: ${diff.description || diff.newValue || diff.oldValue}`);
      }
    }
  }

  lines.push('');
  lines.push(`Comparison completed in ${summary.duration}ms`);

  return lines.join('\n');
}

/**
 * Props for the ComparisonSummary component
 */
export interface ComparisonSummaryProps {
  /** Comparison result data */
  result: ComparisonResult | null;
  /** Whether comparison is in progress */
  isLoading?: boolean;
  /** PDF 1 filename */
  pdf1Name?: string;
  /** PDF 2 filename */
  pdf2Name?: string;
  /** Callback when a page is clicked */
  onPageClick?: (pageNum: number) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/**
 * Get similarity color class based on percentage
 */
function getSimilarityColor(similarity: number): string {
  if (similarity >= 90) return 'text-green-600 dark:text-green-400';
  if (similarity >= 70) return 'text-yellow-600 dark:text-yellow-400';
  if (similarity >= 50) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get progress bar color based on percentage
 */
function getProgressColor(similarity: number): string {
  if (similarity >= 90) return 'bg-green-500';
  if (similarity >= 70) return 'bg-yellow-500';
  if (similarity >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Stat card component for displaying a single statistic
 */
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  description?: string;
  colorClass?: string;
}

function StatCard({ icon, label, value, description, colorClass }: StatCardProps) {
  return (
    <div className="flex items-start gap-3 p-3 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
      <div className={cn('p-2 rounded-lg bg-card dark:bg-surface-700', colorClass)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
        <p className="text-lg font-semibold text-surface-900 dark:text-white">{value}</p>
        {description && (
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

/**
 * ComparisonSummary Component
 *
 * Shows a comprehensive summary of PDF comparison results
 * with statistics, charts, and export functionality.
 */
export function ComparisonSummary({
  result,
  isLoading = false,
  pdf1Name = 'Original PDF',
  pdf2Name = 'Modified PDF',
  onPageClick,
  className,
}: ComparisonSummaryProps) {
  /**
   * Download comparison report as text file
   */
  const handleDownloadReport = useCallback(() => {
    if (!result) return;

    const report = generateDiffReport(result);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'pdf-comparison-report.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [result]);

  /**
   * Download comparison report as JSON
   */
  const handleDownloadJSON = useCallback(() => {
    if (!result) return;

    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'pdf-comparison-report.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [result]);

  if (isLoading) {
    return (
      <Card className={cn('', className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-primary-500 mr-3" />
            <span className="text-surface-600 dark:text-surface-400">
              Comparing PDFs...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className={cn('', className)}>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-surface-300 dark:text-surface-600 mb-3" />
            <p className="text-surface-500 dark:text-surface-400">
              Upload two PDFs to compare them
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, pages } = result;
  const isIdentical = summary.pagesChanged === 0 && summary.textChanges === 0;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {isIdentical ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-orange-500" />
            )}
            Comparison Summary
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadReport}>
              <Download className="h-4 w-4 mr-1" />
              Report
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadJSON}>
              <Download className="h-4 w-4 mr-1" />
              JSON
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall similarity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Overall Similarity
            </span>
            <span className={cn('text-2xl font-bold', getSimilarityColor(summary.overallSimilarity))}>
              {summary.overallSimilarity}%
            </span>
          </div>
          <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', getProgressColor(summary.overallSimilarity))}
              style={{ width: `${summary.overallSimilarity}%` }}
            />
          </div>
          {summary.visualSimilarity !== undefined && (
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Visual similarity: {summary.visualSimilarity}%
            </p>
          )}
        </div>

        {/* File info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
          <div>
            <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Original</p>
            <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
              {pdf1Name}
            </p>
            <p className="text-xs text-surface-400 dark:text-surface-500">
              {summary.pdf1PageCount} page{summary.pdf1PageCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div>
            <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Modified</p>
            <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
              {pdf2Name}
            </p>
            <p className="text-xs text-surface-400 dark:text-surface-500">
              {summary.pdf2PageCount} page{summary.pdf2PageCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Statistics grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Layout className="h-4 w-4 text-blue-500" />}
            label="Pages Changed"
            value={summary.pagesChanged}
            description={`of ${Math.max(summary.pdf1PageCount, summary.pdf2PageCount)} total`}
          />
          <StatCard
            icon={<CheckCircle className="h-4 w-4 text-green-500" />}
            label="Pages Identical"
            value={summary.pagesIdentical}
          />
          <StatCard
            icon={<Plus className="h-4 w-4 text-green-500" />}
            label="Additions"
            value={summary.textAdditions}
            colorClass="text-green-600"
          />
          <StatCard
            icon={<Minus className="h-4 w-4 text-red-500" />}
            label="Deletions"
            value={summary.textDeletions}
            colorClass="text-red-600"
          />
          <StatCard
            icon={<RefreshCw className="h-4 w-4 text-yellow-500" />}
            label="Modifications"
            value={summary.textModifications}
            colorClass="text-yellow-600"
          />
          <StatCard
            icon={<Clock className="h-4 w-4 text-surface-500" />}
            label="Duration"
            value={formatDuration(summary.duration)}
          />
        </div>

        {/* Pages with differences */}
        {summary.pagesChanged > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Pages with Differences
            </h4>
            <div className="flex flex-wrap gap-2">
              {pages
                .filter(p => p.differences.length > 0)
                .map(page => (
                  <button
                    key={page.pageNum}
                    onClick={() => onPageClick?.(page.pageNum)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      'border border-surface-200 dark:border-surface-700',
                      'hover:bg-surface-100 dark:hover:bg-surface-800',
                      page.similarity >= 90
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : page.similarity >= 50
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    )}
                  >
                    Page {page.pageNum}
                    <span className="ml-1 text-xs opacity-75">
                      ({page.differences.length})
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Identical message */}
        {isIdentical && (
          <div className="flex items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-green-700 dark:text-green-400 font-medium">
              The PDFs are identical
            </span>
          </div>
        )}

        {/* Text diff summary */}
        {result.textDiff && result.textDiff.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Text Differences ({result.textDiff.filter(d => d.type !== 'unchanged').length})
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs font-mono bg-surface-50 dark:bg-surface-800/50 p-3 rounded-lg">
              {result.textDiff
                .filter(d => d.type !== 'unchanged')
                .slice(0, 20)
                .map((diff, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-1 rounded',
                      diff.type === 'added' && 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
                      diff.type === 'removed' && 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
                      diff.type === 'modified' && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                    )}
                  >
                    <span className="opacity-50 mr-2">
                      {diff.type === 'added' ? '+' : diff.type === 'removed' ? '-' : '~'}
                    </span>
                    {diff.type === 'removed' ? diff.originalText : diff.modifiedText}
                  </div>
                ))}
              {result.textDiff.filter(d => d.type !== 'unchanged').length > 20 && (
                <p className="text-surface-400 dark:text-surface-500 text-center pt-2">
                  ... and {result.textDiff.filter(d => d.type !== 'unchanged').length - 20} more
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ComparisonSummary;
