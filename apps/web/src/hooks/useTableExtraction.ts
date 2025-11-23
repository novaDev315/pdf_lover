/**
 * React hook for PDF table extraction operations
 *
 * Provides a clean interface for extracting tables from PDFs
 * with progress tracking, table editing, and export capabilities.
 */

import { useState, useCallback, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  extractTables,
  detectTableRegions,
  getTableCount,
  tableToCSV,
  tablesToCSV,
  tableToExcel,
  tablesToExcel,
  tableToJSON,
  tablesToJSON,
  createTableFilename,
} from '@pdflover/pdf-core';
import type {
  ExtractedTable,
  ExtractTablesOptions,
  ExtractTablesResult,
  TableCountResult,
  TableRegion,
  ExcelWorkbook,
} from '@pdflover/pdf-core';
import { db } from '@/lib/storage/indexeddb';

/**
 * Extraction state
 */
export type TableExtractionState = 'idle' | 'counting' | 'detecting' | 'extracting' | 'completed' | 'error';

/**
 * Extraction progress information
 */
export interface TableExtractionProgress {
  /** Current stage description */
  stage: string;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current page being processed */
  currentPage?: number;
  /** Total pages to process */
  totalPages?: number;
}

/**
 * Cell edit operation
 */
export interface CellEdit {
  /** Table ID */
  tableId: string;
  /** Row index */
  rowIndex: number;
  /** Column index */
  colIndex: number;
  /** New value */
  value: string;
}

/**
 * Options for the useTableExtraction hook
 */
export interface UseTableExtractionOptions {
  /** Enable caching of results */
  enableCache?: boolean;
  /** Callback when extraction completes */
  onComplete?: (tables: ExtractedTable[]) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * Return type for the useTableExtraction hook
 */
export interface UseTableExtractionReturn {
  /** Current extraction state */
  state: TableExtractionState;
  /** Progress information */
  progress: TableExtractionProgress;
  /** Extracted tables */
  tables: ExtractedTable[];
  /** Detected table regions */
  regions: TableRegion[];
  /** Table count result */
  tableCount: TableCountResult | null;
  /** Error message */
  error: string | null;
  /** Extract tables from PDF */
  extractFromPdf: (pdf: PDFDocumentProxy, options?: ExtractTablesOptions) => Promise<ExtractedTable[]>;
  /** Detect table regions without full extraction */
  detectRegions: (pdf: PDFDocumentProxy, options?: ExtractTablesOptions) => Promise<TableRegion[]>;
  /** Count tables without extracting */
  countTables: (pdf: PDFDocumentProxy) => Promise<TableCountResult>;
  /** Get a single table by ID */
  getTable: (id: string) => ExtractedTable | undefined;
  /** Get tables by page */
  getTablesByPage: (page: number) => ExtractedTable[];
  /** Edit a cell value */
  editCell: (edit: CellEdit) => void;
  /** Batch edit cells */
  editCells: (edits: CellEdit[]) => void;
  /** Export table to CSV */
  exportToCSV: (tableId: string) => string;
  /** Export all tables to CSV */
  exportAllToCSV: () => string;
  /** Export table to Excel format */
  exportToExcel: (tableId: string) => ExcelWorkbook;
  /** Export all tables to Excel format */
  exportAllToExcel: () => ExcelWorkbook;
  /** Export table to JSON */
  exportToJSON: (tableId: string, useHeaders?: boolean) => string;
  /** Export all tables to JSON */
  exportAllToJSON: (useHeaders?: boolean) => string;
  /** Get table as clipboard text */
  getClipboardText: (tableId: string) => string;
  /** Create filename for export */
  createFilename: (table: ExtractedTable, format: 'csv' | 'xlsx' | 'json', prefix?: string) => string;
  /** Cancel ongoing operation */
  cancel: () => void;
  /** Reset state */
  reset: () => void;
  /** Update table (for editing) */
  updateTable: (tableId: string, updates: Partial<ExtractedTable>) => void;
}

/**
 * Cached extraction result
 */
interface CachedTableResult {
  /** Document ID */
  documentId: string;
  /** Extracted tables */
  tables: ExtractedTable[];
  /** Options used */
  options: string;
  /** Timestamp */
  cachedAt: Date;
}

/**
 * Generate cache key from options
 */
function generateCacheKey(documentId: string, options: ExtractTablesOptions): string {
  const optString = JSON.stringify({
    pages: options.pages,
    detectHeaders: options.detectHeaders,
    minConfidence: options.minConfidence,
    handleMergedCells: options.handleMergedCells,
    minRows: options.minRows,
    minColumns: options.minColumns,
  });
  return `table_extract_${documentId}_${optString}`;
}

/**
 * React hook for table extraction from PDFs
 *
 * @param options - Hook options
 * @returns Extraction state and control functions
 *
 * @example
 * ```tsx
 * function TableExtractor() {
 *   const {
 *     state,
 *     progress,
 *     tables,
 *     extractFromPdf,
 *     exportToCSV,
 *   } = useTableExtraction({
 *     onComplete: (tables) => console.log(`Extracted ${tables.length} tables`),
 *   });
 *
 *   const handleExtract = async () => {
 *     const pdfDoc = await loadPdf(file);
 *     await extractFromPdf(pdfDoc, { detectHeaders: true });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleExtract} disabled={state === 'extracting'}>
 *         Extract Tables
 *       </button>
 *       {state === 'extracting' && (
 *         <div>{progress.stage} - {progress.percentage}%</div>
 *       )}
 *       <div>
 *         {tables.map((table) => (
 *           <TablePreview key={table.id} table={table} />
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTableExtraction(options: UseTableExtractionOptions = {}): UseTableExtractionReturn {
  const { enableCache = false, onComplete, onError } = options;

  const [state, setState] = useState<TableExtractionState>('idle');
  const [progress, setProgress] = useState<TableExtractionProgress>({
    stage: '',
    percentage: 0,
  });
  const [tables, setTables] = useState<ExtractedTable[]>([]);
  const [regions, setRegions] = useState<TableRegion[]>([]);
  const [tableCount, setTableCount] = useState<TableCountResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancelledRef = useRef(false);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState('idle');
    setProgress({ stage: '', percentage: 0 });
    setTables([]);
    setRegions([]);
    setTableCount(null);
    setError(null);
    cancelledRef.current = false;
  }, []);

  /**
   * Cancel ongoing operation
   */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setState('idle');
    setProgress({ stage: 'Cancelled', percentage: 0 });
  }, []);

  /**
   * Check cache for existing result
   */
  const checkCache = useCallback(async (
    documentId: string,
    extractOptions: ExtractTablesOptions
  ): Promise<ExtractedTable[] | null> => {
    if (!enableCache) return null;

    try {
      const cacheKey = generateCacheKey(documentId, extractOptions);
      const cached = await db.getSetting<CachedTableResult>(cacheKey);

      if (cached) {
        // Check if not too old (1 hour)
        const age = Date.now() - cached.cachedAt.getTime();
        const maxAge = 60 * 60 * 1000;
        if (age < maxAge) {
          return cached.tables;
        }
      }
    } catch {
      // Cache miss
    }
    return null;
  }, [enableCache]);

  /**
   * Save result to cache
   */
  const saveToCache = useCallback(async (
    documentId: string,
    extractOptions: ExtractTablesOptions,
    extractedTables: ExtractedTable[]
  ) => {
    if (!enableCache) return;

    try {
      const cacheKey = generateCacheKey(documentId, extractOptions);
      const cached: CachedTableResult = {
        documentId,
        tables: extractedTables,
        options: JSON.stringify(extractOptions),
        cachedAt: new Date(),
      };
      await db.saveSetting(cacheKey, cached);
    } catch {
      // Ignore cache errors
    }
  }, [enableCache]);

  /**
   * Extract tables from PDF
   */
  const extractFromPdf = useCallback(async (
    pdf: PDFDocumentProxy,
    extractOptions: ExtractTablesOptions = {}
  ): Promise<ExtractedTable[]> => {
    if (cancelledRef.current) return [];

    // Generate document ID for caching
    const documentId = `pdf_${pdf.fingerprints[0] || Date.now()}`;

    // Check cache
    const cached = await checkCache(documentId, extractOptions);
    if (cached) {
      setTables(cached);
      setState('completed');
      setProgress({ stage: 'Loaded from cache', percentage: 100 });
      onComplete?.(cached);
      return cached;
    }

    try {
      setState('extracting');
      setError(null);
      cancelledRef.current = false;

      const result = await extractTables(pdf, {
        ...extractOptions,
        onProgress: (info) => {
          if (cancelledRef.current) return;
          setProgress({
            stage: info.stage,
            percentage: info.percentage,
            currentPage: info.currentItem,
            totalPages: info.totalItems,
          });
        },
      });

      if (cancelledRef.current) return [];

      if (result.success) {
        setTables(result.tables);
        setState('completed');
        setProgress({ stage: 'Complete', percentage: 100 });

        // Save to cache
        await saveToCache(documentId, extractOptions, result.tables);

        onComplete?.(result.tables);
        return result.tables;
      } else {
        throw new Error(result.error ?? 'Failed to extract tables');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Extraction failed';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return [];
    }
  }, [checkCache, saveToCache, onComplete, onError]);

  /**
   * Detect table regions without full extraction
   */
  const detectRegions = useCallback(async (
    pdf: PDFDocumentProxy,
    detectOptions: ExtractTablesOptions = {}
  ): Promise<TableRegion[]> => {
    if (cancelledRef.current) return [];

    try {
      setState('detecting');
      setError(null);

      const detected = await detectTableRegions(pdf, {
        ...detectOptions,
        onProgress: (info) => {
          if (cancelledRef.current) return;
          setProgress({
            stage: info.stage,
            percentage: info.percentage,
            currentPage: info.currentItem,
            totalPages: info.totalItems,
          });
        },
      });

      if (cancelledRef.current) return [];

      setRegions(detected);
      setState('completed');
      setProgress({ stage: 'Complete', percentage: 100 });

      return detected;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Detection failed';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return [];
    }
  }, [onError]);

  /**
   * Count tables without extracting
   */
  const countTables = useCallback(async (pdf: PDFDocumentProxy): Promise<TableCountResult> => {
    if (cancelledRef.current) return { total: 0, perPage: [] };

    try {
      setState('counting');
      setError(null);
      setProgress({ stage: 'Counting tables...', percentage: 0 });

      const count = await getTableCount(pdf, {
        onProgress: (info) => {
          if (cancelledRef.current) return;
          setProgress({
            stage: info.stage,
            percentage: info.percentage,
          });
        },
      });

      if (cancelledRef.current) return { total: 0, perPage: [] };

      setTableCount(count);
      setState('completed');
      setProgress({ stage: 'Complete', percentage: 100 });

      return count;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to count tables';
      setState('error');
      setError(errorMessage);
      onError?.(errorMessage);
      return { total: 0, perPage: [] };
    }
  }, [onError]);

  /**
   * Get a single table by ID
   */
  const getTable = useCallback((id: string): ExtractedTable | undefined => {
    return tables.find(t => t.id === id);
  }, [tables]);

  /**
   * Get tables by page number
   */
  const getTablesByPage = useCallback((page: number): ExtractedTable[] => {
    return tables.filter(t => t.page === page);
  }, [tables]);

  /**
   * Edit a single cell value
   */
  const editCell = useCallback((edit: CellEdit) => {
    setTables(prev => prev.map(table => {
      if (table.id !== edit.tableId) return table;

      const newRows = [...table.rows];
      if (newRows[edit.rowIndex]) {
        newRows[edit.rowIndex] = [...newRows[edit.rowIndex]!];
        newRows[edit.rowIndex]![edit.colIndex] = edit.value;
      }

      const newCells = [...table.cells];
      if (newCells[edit.rowIndex]) {
        newCells[edit.rowIndex] = [...newCells[edit.rowIndex]!];
        if (newCells[edit.rowIndex]![edit.colIndex]) {
          newCells[edit.rowIndex]![edit.colIndex] = {
            ...newCells[edit.rowIndex]![edit.colIndex]!,
            value: edit.value,
          };
        }
      }

      return {
        ...table,
        rows: newRows,
        cells: newCells,
      };
    }));
  }, []);

  /**
   * Batch edit cells
   */
  const editCells = useCallback((edits: CellEdit[]) => {
    edits.forEach(edit => editCell(edit));
  }, [editCell]);

  /**
   * Update a table
   */
  const updateTable = useCallback((tableId: string, updates: Partial<ExtractedTable>) => {
    setTables(prev => prev.map(table => {
      if (table.id !== tableId) return table;
      return { ...table, ...updates };
    }));
  }, []);

  /**
   * Export single table to CSV
   */
  const exportToCSV = useCallback((tableId: string): string => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return '';
    return tableToCSV(table);
  }, [tables]);

  /**
   * Export all tables to CSV
   */
  const exportAllToCSV = useCallback((): string => {
    return tablesToCSV(tables);
  }, [tables]);

  /**
   * Export single table to Excel format
   */
  const exportToExcel = useCallback((tableId: string): ExcelWorkbook => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return { sheets: [] };
    return { sheets: [tableToExcel(table)] };
  }, [tables]);

  /**
   * Export all tables to Excel format
   */
  const exportAllToExcel = useCallback((): ExcelWorkbook => {
    return tablesToExcel(tables);
  }, [tables]);

  /**
   * Export single table to JSON
   */
  const exportToJSON = useCallback((tableId: string, useHeaders = true): string => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return '[]';
    return JSON.stringify(tableToJSON(table, { useHeaders }), null, 2);
  }, [tables]);

  /**
   * Export all tables to JSON
   */
  const exportAllToJSON = useCallback((useHeaders = true): string => {
    return JSON.stringify(tablesToJSON(tables, { useHeaders }), null, 2);
  }, [tables]);

  /**
   * Get table as clipboard-friendly text
   */
  const getClipboardText = useCallback((tableId: string): string => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return '';
    // Use tab-separated values for spreadsheet compatibility
    return tableToCSV(table, { delimiter: '\t' });
  }, [tables]);

  /**
   * Create filename for export
   */
  const createFilename = useCallback((
    table: ExtractedTable,
    format: 'csv' | 'xlsx' | 'json',
    prefix = 'table'
  ): string => {
    return createTableFilename(table, format, prefix);
  }, []);

  return {
    state,
    progress,
    tables,
    regions,
    tableCount,
    error,
    extractFromPdf,
    detectRegions,
    countTables,
    getTable,
    getTablesByPage,
    editCell,
    editCells,
    exportToCSV,
    exportAllToCSV,
    exportToExcel,
    exportAllToExcel,
    exportToJSON,
    exportAllToJSON,
    getClipboardText,
    createFilename,
    cancel,
    reset,
    updateTable,
  };
}

export default useTableExtraction;
