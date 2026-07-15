/**
 * ClassifyPage - Full page for document classification
 * Provides single document and batch classification modes with statistics
 */

import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  BarChart3,
  Download,
  Brain,
  Info,
  Tag,
  TrendingUp,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ClassificationPanel } from '@/components/smart/ClassificationPanel';
import { cn, downloadBlob } from '@/lib/utils';
import {
  getDocumentTypes,
  getDocumentTypeLabel,
  getDocumentTypeDescription,
  type EnhancedClassification,
  type DocumentType,
} from '@/lib/ai/classifier';

/**
 * Get color classes for document type badge
 */
function getTypeColor(type: DocumentType): string {
  const colors: Record<DocumentType, string> = {
    invoice: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
    contract: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950 dark:border-purple-800',
    report: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800',
    resume: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800',
    academic: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-950 dark:border-indigo-800',
    form: 'text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-950 dark:border-cyan-800',
    letter: 'text-pink-600 bg-pink-50 border-pink-200 dark:text-pink-400 dark:bg-pink-950 dark:border-pink-800',
    legal: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800',
    financial: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800',
    medical: 'text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950 dark:border-rose-800',
    other: 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700',
  };
  return colors[type] || colors.other;
}

/**
 * Get icon color for document type
 */
function getTypeIconColor(type: DocumentType): string {
  const colors: Record<DocumentType, string> = {
    invoice: 'text-blue-500',
    contract: 'text-purple-500',
    report: 'text-green-500',
    resume: 'text-orange-500',
    academic: 'text-indigo-500',
    form: 'text-cyan-500',
    letter: 'text-pink-500',
    legal: 'text-red-500',
    financial: 'text-emerald-500',
    medical: 'text-rose-500',
    other: 'text-gray-500',
  };
  return colors[type] || colors.other;
}

/**
 * Statistics state
 */
interface ClassificationStats {
  results: EnhancedClassification[];
  byType: Record<DocumentType, number>;
  avgConfidence: number;
  totalProcessed: number;
}

/**
 * ClassifyPage component
 */
export function ClassifyPage() {
  const [stats, setStats] = React.useState<ClassificationStats>({
    results: [],
    byType: {} as Record<DocumentType, number>,
    avgConfidence: 0,
    totalProcessed: 0,
  });

  /**
   * Handle classification complete
   */
  const handleClassificationComplete = React.useCallback((results: EnhancedClassification[]) => {
    setStats((prev) => {
      const allResults = [...prev.results, ...results];
      const byType: Record<DocumentType, number> = {} as Record<DocumentType, number>;

      // Count by type
      for (const result of allResults) {
        byType[result.type] = (byType[result.type] || 0) + 1;
      }

      // Calculate average confidence
      const avgConfidence = allResults.length > 0
        ? Math.round(allResults.reduce((sum, r) => sum + r.confidence, 0) / allResults.length)
        : 0;

      return {
        results: allResults,
        byType,
        avgConfidence,
        totalProcessed: allResults.length,
      };
    });
  }, []);

  /**
   * Export all history as JSON
   */
  const handleExportHistory = React.useCallback(() => {
    if (stats.results.length === 0) return;

    const data = stats.results.map((r) => ({
      type: r.type,
      confidence: r.confidence,
      confidenceLevel: r.confidenceLevel,
      alternatives: r.alternatives,
      keywordCount: r.features.keywords.length,
      topKeywords: r.features.keywords.slice(0, 10).map((k) => k.keyword),
      usedML: r.usedML,
      processingTime: r.processingTime,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `classification-history-${new Date().toISOString().slice(0, 10)}.json`);
  }, [stats.results]);

  /**
   * Clear stats
   */
  const handleClearStats = React.useCallback(() => {
    setStats({
      results: [],
      byType: {} as Record<DocumentType, number>,
      avgConfidence: 0,
      totalProcessed: 0,
    });
  }, []);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <div className="border-b border-surface-200 dark:border-surface-800 bg-card dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-surface-600 dark:text-surface-400" />
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-7 w-7 text-purple-500" />
                Document Classification
              </h1>
              <p className="text-surface-600 dark:text-surface-400 mt-1">
                Automatically identify document types using AI-powered analysis
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Panel - 2 columns */}
          <div className="lg:col-span-2">
            <ClassificationPanel
              onClassificationComplete={handleClassificationComplete}
            />
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Session Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-primary-500" />
                  Session Statistics
                </CardTitle>
                <CardDescription>
                  Classification results from this session
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats.totalProcessed > 0 ? (
                  <>
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg text-center">
                        <p className="text-2xl font-bold text-surface-900 dark:text-white">
                          {stats.totalProcessed}
                        </p>
                        <p className="text-xs text-surface-500">Documents</p>
                      </div>
                      <div className="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg text-center">
                        <p className={cn(
                          'text-2xl font-bold',
                          stats.avgConfidence >= 70
                            ? 'text-green-600 dark:text-green-400'
                            : stats.avgConfidence >= 40
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        )}>
                          {stats.avgConfidence}%
                        </p>
                        <p className="text-xs text-surface-500">Avg Confidence</p>
                      </div>
                    </div>

                    {/* Type Distribution */}
                    <div>
                      <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                        Type Distribution
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(stats.byType)
                          .sort((a, b) => b[1] - a[1])
                          .map(([type, count]) => (
                            <div key={type} className="flex items-center gap-2">
                              <Tag className={cn('h-4 w-4', getTypeIconColor(type as DocumentType))} />
                              <span className="flex-1 text-sm text-surface-600 dark:text-surface-400">
                                {getDocumentTypeLabel(type as DocumentType)}
                              </span>
                              <span className={cn(
                                'px-2 py-0.5 text-xs font-medium rounded-full border',
                                getTypeColor(type as DocumentType)
                              )}>
                                {count}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-surface-200 dark:border-surface-700">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportHistory}
                        className="flex-1"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearStats}
                        className="text-red-500"
                      >
                        Clear
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      No documents classified yet.
                    </p>
                    <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                      Upload and classify documents to see statistics.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Document Types Reference */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Info className="h-5 w-5 text-blue-500" />
                  Supported Document Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {getDocumentTypes().map((type) => (
                    <div
                      key={type}
                      className="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded-full border',
                          getTypeColor(type)
                        )}>
                          {getDocumentTypeLabel(type)}
                        </span>
                      </div>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        {getDocumentTypeDescription(type)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tips Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5 text-purple-500" />
                  Classification Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">1.</span>
                    <span>
                      <strong>Enable ML mode</strong> for improved accuracy on complex documents.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">2.</span>
                    <span>
                      <strong>Low confidence</strong> results may need manual review or re-classification.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">3.</span>
                    <span>
                      Use <strong>batch mode</strong> for organizing large document collections.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">4.</span>
                    <span>
                      <strong>Export results</strong> as CSV/JSON for integration with other tools.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">5.</span>
                    <span>
                      <strong>Manual overrides</strong> are saved and included in exports.
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
