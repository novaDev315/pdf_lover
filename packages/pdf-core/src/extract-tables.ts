/**
 * PDF table extraction functionality for @pdflover/pdf-core
 *
 * Extracts tables from PDF documents using PDF.js text extraction
 * with intelligent table detection based on alignment and spacing
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
import type { ProgressCallback, ProgressInfo } from '@pdflover/shared';

/**
 * Bounding box for a table region
 */
export interface TableBounds {
  /** Left position */
  x: number;
  /** Top position */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
}

/**
 * Extracted table cell
 */
export interface TableCell {
  /** Cell content */
  value: string;
  /** Row span (for merged cells) */
  rowSpan: number;
  /** Column span (for merged cells) */
  colSpan: number;
  /** Whether this is a header cell */
  isHeader: boolean;
  /** Original bounding box */
  bounds?: TableBounds;
}

/**
 * Extracted table data
 */
export interface ExtractedTable {
  /** Unique identifier for the table */
  id: string;
  /** Page number (1-indexed) */
  page: number;
  /** Table index on the page (0-indexed) */
  index: number;
  /** Table rows as 2D array of strings */
  rows: string[][];
  /** Detailed cell data with merge information */
  cells: TableCell[][];
  /** Detected header row indices */
  headerRows: number[];
  /** Table bounding box */
  bounds: TableBounds;
  /** Number of rows */
  rowCount: number;
  /** Number of columns */
  columnCount: number;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Table region detected in a PDF page
 */
export interface TableRegion {
  /** Page number */
  page: number;
  /** Region index */
  index: number;
  /** Bounding box */
  bounds: TableBounds;
  /** Text items in this region */
  textItems: TextItemWithPosition[];
  /** Confidence that this is a table */
  confidence: number;
}

/**
 * Text item with position information
 */
interface TextItemWithPosition {
  /** Text content */
  str: string;
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Font name */
  fontName?: string;
}

/**
 * Options for table extraction
 */
export interface ExtractTablesOptions {
  /** Specific pages to extract from (1-indexed), defaults to all pages */
  pages?: number[];
  /** Whether to detect header rows (default: true) */
  detectHeaders?: boolean;
  /** Minimum confidence threshold (0-1, default: 0.5) */
  minConfidence?: number;
  /** Whether to handle merged cells (default: true) */
  handleMergedCells?: boolean;
  /** Minimum number of rows to consider as table (default: 2) */
  minRows?: number;
  /** Minimum number of columns to consider as table (default: 2) */
  minColumns?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Result of table extraction
 */
export interface ExtractTablesResult {
  /** Whether extraction was successful */
  success: boolean;
  /** Extracted tables */
  tables: ExtractedTable[];
  /** Total tables found */
  totalFound: number;
  /** Processing duration in ms */
  duration: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Table count result
 */
export interface TableCountResult {
  /** Total tables across all pages */
  total: number;
  /** Tables per page */
  perPage: { page: number; count: number }[];
}

/**
 * Excel export format (compatible with xlsx library)
 */
export interface ExcelWorksheet {
  /** Worksheet name */
  name: string;
  /** Data as 2D array */
  data: (string | number | null)[][];
  /** Column widths */
  columnWidths?: number[];
  /** Merged cell ranges */
  merges?: { startRow: number; endRow: number; startCol: number; endCol: number }[];
}

/**
 * Excel workbook for export
 */
export interface ExcelWorkbook {
  /** Worksheets */
  sheets: ExcelWorksheet[];
}

// Constants for table detection
const ROW_TOLERANCE = 5; // Pixels tolerance for same row detection
const COLUMN_TOLERANCE = 10; // Pixels tolerance for column alignment
const MIN_TABLE_CONFIDENCE = 0.5;
const HEADER_DETECTION_PATTERNS = [
  /^(no\.?|#|id|sr\.?\s*no\.?|s\.?\s*no\.?)$/i,
  /^(name|description|item|product|service)$/i,
  /^(date|time|datetime|timestamp)$/i,
  /^(amount|price|cost|total|value|qty|quantity|rate)$/i,
  /^(status|type|category|class)$/i,
];

/**
 * Generate unique table ID
 */
function generateTableId(): string {
  return `table_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Extract text items with position from a PDF page
 */
async function extractTextItemsFromPage(
  page: any
): Promise<TextItemWithPosition[]> {
  const textContent = await page.getTextContent();
  const items: TextItemWithPosition[] = [];

  for (const item of textContent.items) {
    if ('str' in item && item.str.trim()) {
      const textItem = item as TextItem;
      const transform = textItem.transform;

      items.push({
        str: textItem.str,
        x: transform[4],
        y: transform[5],
        width: textItem.width,
        height: textItem.height,
        fontName: textItem.fontName,
      });
    }
  }

  return items;
}

/**
 * Group text items into rows based on Y position
 */
function groupIntoRows(items: TextItemWithPosition[]): TextItemWithPosition[][] {
  if (items.length === 0) return [];

  // Sort by Y position (descending - PDF coordinates have origin at bottom)
  const sorted = [...items].sort((a, b) => b.y - a.y);

  const rows: TextItemWithPosition[][] = [];
  let currentRow: TextItemWithPosition[] = [sorted[0]!];
  let currentY = sorted[0]!.y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i]!;

    if (Math.abs(item.y - currentY) <= ROW_TOLERANCE) {
      currentRow.push(item);
    } else {
      // Sort current row by X position
      currentRow.sort((a, b) => a.x - b.x);
      rows.push(currentRow);
      currentRow = [item];
      currentY = item.y;
    }
  }

  // Don't forget the last row
  if (currentRow.length > 0) {
    currentRow.sort((a, b) => a.x - b.x);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Detect column boundaries from text items
 */
function detectColumnBoundaries(rows: TextItemWithPosition[][]): number[] {
  if (rows.length === 0) return [];

  // Collect all X positions
  const xPositions: Map<number, number> = new Map();

  for (const row of rows) {
    for (const item of row) {
      // Round to reduce noise
      const roundedX = Math.round(item.x / COLUMN_TOLERANCE) * COLUMN_TOLERANCE;
      xPositions.set(roundedX, (xPositions.get(roundedX) || 0) + 1);
    }
  }

  // Find positions that appear frequently (likely column starts)
  const threshold = Math.max(2, Math.floor(rows.length * 0.3));
  const columnStarts = Array.from(xPositions.entries())
    .filter(([_, count]) => count >= threshold)
    .map(([x, _]) => x)
    .sort((a, b) => a - b);

  return columnStarts;
}

/**
 * Assign text items to columns
 */
function assignToColumns(
  row: TextItemWithPosition[],
  columnBoundaries: number[]
): string[] {
  if (columnBoundaries.length === 0) {
    return row.map(item => item.str);
  }

  const columns: string[] = new Array(columnBoundaries.length).fill('');

  for (const item of row) {
    // Find the closest column boundary
    let columnIndex = 0;
    let minDistance = Math.abs(item.x - columnBoundaries[0]!);

    for (let i = 1; i < columnBoundaries.length; i++) {
      const distance = Math.abs(item.x - columnBoundaries[i]!);
      if (distance < minDistance) {
        minDistance = distance;
        columnIndex = i;
      }
    }

    // Append to existing content with space if needed
    if (columns[columnIndex]) {
      columns[columnIndex] += ' ' + item.str;
    } else {
      columns[columnIndex] = item.str;
    }
  }

  return columns;
}

/**
 * Calculate table confidence score
 */
function calculateConfidence(
  rows: string[][],
  columnBoundaries: number[]
): number {
  if (rows.length < 2 || columnBoundaries.length < 2) {
    return 0;
  }

  let score = 0;

  // Factor 1: Consistent column count (higher score for more consistent)
  const columnCounts = rows.map(row => row.filter(cell => cell.trim()).length);
  const modeColumnCount = columnCounts.sort((a, b) =>
    columnCounts.filter(v => v === a).length - columnCounts.filter(v => v === b).length
  ).pop() || 0;
  const consistencyRatio = columnCounts.filter(c => c === modeColumnCount).length / rows.length;
  score += consistencyRatio * 0.4;

  // Factor 2: Number of rows and columns
  if (rows.length >= 3) score += 0.2;
  if (columnBoundaries.length >= 3) score += 0.2;

  // Factor 3: Filled cells ratio
  const totalCells = rows.length * columnBoundaries.length;
  const filledCells = rows.reduce(
    (sum, row) => sum + row.filter(cell => cell.trim()).length,
    0
  );
  const fillRatio = filledCells / totalCells;
  score += fillRatio * 0.2;

  return Math.min(1, score);
}

/**
 * Detect if a row is likely a header row
 */
function isLikelyHeaderRow(row: string[], rowIndex: number): boolean {
  // First row is often a header
  if (rowIndex === 0) {
    // Check if cells match common header patterns
    const headerMatches = row.filter(cell => {
      const trimmed = cell.trim().toLowerCase();
      return HEADER_DETECTION_PATTERNS.some(pattern => pattern.test(trimmed));
    }).length;

    if (headerMatches >= 1) return true;
  }

  // Check if row contains mostly short text (typical for headers)
  const avgLength = row.reduce((sum, cell) => sum + cell.length, 0) / row.length;
  const hasShortCells = avgLength < 20;

  // Check if row has no numbers (headers typically don't have numeric data)
  const hasNoNumbers = !row.some(cell => /^\d+([.,]\d+)?$/.test(cell.trim()));

  return rowIndex === 0 && hasShortCells && hasNoNumbers;
}

/**
 * Detect table regions in a PDF page
 */
async function detectTableRegionsInPage(
  page: any,
  pageNumber: number,
  options: ExtractTablesOptions
): Promise<TableRegion[]> {
  const textItems = await extractTextItemsFromPage(page);

  if (textItems.length === 0) {
    return [];
  }

  const rows = groupIntoRows(textItems);
  const minRows = options.minRows ?? 2;
  const minColumns = options.minColumns ?? 2;

  // For now, treat the entire page as a potential table region
  // A more sophisticated approach would detect multiple regions
  if (rows.length < minRows) {
    return [];
  }

  const columnBoundaries = detectColumnBoundaries(rows);

  if (columnBoundaries.length < minColumns) {
    return [];
  }

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of textItems) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }

  const parsedRows = rows.map(row => assignToColumns(row, columnBoundaries));
  const confidence = calculateConfidence(parsedRows, columnBoundaries);

  if (confidence < (options.minConfidence ?? MIN_TABLE_CONFIDENCE)) {
    return [];
  }

  return [{
    page: pageNumber,
    index: 0,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
    textItems,
    confidence,
  }];
}

/**
 * Parse text items into table structure
 */
export function parseTableStructure(
  textItems: TextItemWithPosition[],
  options: ExtractTablesOptions = {}
): { rows: string[][]; cells: TableCell[][]; headerRows: number[] } {
  const rows = groupIntoRows(textItems);
  const columnBoundaries = detectColumnBoundaries(rows);

  const parsedRows = rows.map(row => assignToColumns(row, columnBoundaries));
  const headerRows: number[] = [];

  // Detect headers if enabled
  if (options.detectHeaders !== false) {
    for (let i = 0; i < Math.min(3, parsedRows.length); i++) {
      if (isLikelyHeaderRow(parsedRows[i]!, i)) {
        headerRows.push(i);
      }
    }
  }

  // Create detailed cell data
  const cells: TableCell[][] = parsedRows.map((row, rowIndex) => {
    return row.map(value => ({
      value,
      rowSpan: 1,
      colSpan: 1,
      isHeader: headerRows.includes(rowIndex),
    }));
  });

  return { rows: parsedRows, cells, headerRows };
}

/**
 * Detect table regions in a PDF document
 *
 * @param pdf - PDF.js document proxy
 * @param options - Detection options
 * @returns Promise with array of table regions
 */
export async function detectTableRegions(
  pdf: PDFDocumentProxy,
  options: ExtractTablesOptions = {}
): Promise<TableRegion[]> {
  const { pages, onProgress } = options;
  const numPages = pdf.numPages;
  const pagesToProcess = pages ?? Array.from({ length: numPages }, (_, i) => i + 1);
  const allRegions: TableRegion[] = [];

  for (let i = 0; i < pagesToProcess.length; i++) {
    const pageNum = pagesToProcess[i]!;

    if (pageNum < 1 || pageNum > numPages) {
      continue;
    }

    onProgress?.({
      percentage: Math.round((i / pagesToProcess.length) * 100),
      stage: `Detecting tables on page ${pageNum}`,
      currentItem: i + 1,
      totalItems: pagesToProcess.length,
    });

    const page = await pdf.getPage(pageNum);
    const regions = await detectTableRegionsInPage(page, pageNum, options);

    allRegions.push(...regions);
  }

  return allRegions;
}

/**
 * Extract tables from a PDF document
 *
 * @param pdf - PDF.js document proxy
 * @param options - Extraction options
 * @returns Promise with extraction result
 *
 * @example
 * ```typescript
 * const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
 * const result = await extractTables(pdf, {
 *   detectHeaders: true,
 *   minConfidence: 0.6,
 *   onProgress: (info) => console.log(info.percentage),
 * });
 * console.log(`Extracted ${result.tables.length} tables`);
 * ```
 */
export async function extractTables(
  pdf: PDFDocumentProxy,
  options: ExtractTablesOptions = {}
): Promise<ExtractTablesResult> {
  const startTime = performance.now();

  try {
    const regions = await detectTableRegions(pdf, options);
    const tables: ExtractedTable[] = [];

    for (const region of regions) {
      const { rows, cells, headerRows } = parseTableStructure(region.textItems, options);

      if (rows.length > 0 && rows[0]!.length > 0) {
        tables.push({
          id: generateTableId(),
          page: region.page,
          index: region.index,
          rows,
          cells,
          headerRows,
          bounds: region.bounds,
          rowCount: rows.length,
          columnCount: rows[0]!.length,
          confidence: region.confidence,
        });
      }
    }

    options.onProgress?.({
      percentage: 100,
      stage: 'Complete',
      currentItem: tables.length,
      totalItems: tables.length,
    });

    return {
      success: true,
      tables,
      totalFound: tables.length,
      duration: Math.round(performance.now() - startTime),
    };
  } catch (error) {
    return {
      success: false,
      tables: [],
      totalFound: 0,
      duration: Math.round(performance.now() - startTime),
      error: error instanceof Error ? error.message : 'Failed to extract tables',
    };
  }
}

/**
 * Convert a single table to CSV string
 *
 * @param table - Extracted table
 * @param options - CSV options
 * @returns CSV string
 *
 * @example
 * ```typescript
 * const csv = tableToCSV(table);
 * downloadBlob(new Blob([csv], { type: 'text/csv' }), 'table.csv');
 * ```
 */
export function tableToCSV(
  table: ExtractedTable,
  options: { delimiter?: string; includeHeaders?: boolean } = {}
): string {
  const { delimiter = ',', includeHeaders = true } = options;

  const escapeCSV = (value: string): string => {
    // Escape quotes and wrap in quotes if needed
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const rowsToInclude = includeHeaders ? table.rows : table.rows.slice(table.headerRows.length);

  return rowsToInclude
    .map(row => row.map(cell => escapeCSV(cell)).join(delimiter))
    .join('\n');
}

/**
 * Convert multiple tables to a single CSV string
 *
 * @param tables - Array of extracted tables
 * @param options - CSV options
 * @returns CSV string with all tables
 *
 * @example
 * ```typescript
 * const csv = tablesToCSV(tables);
 * downloadBlob(new Blob([csv], { type: 'text/csv' }), 'all_tables.csv');
 * ```
 */
export function tablesToCSV(
  tables: ExtractedTable[],
  options: { delimiter?: string; separatorRow?: boolean } = {}
): string {
  const { delimiter = ',', separatorRow = true } = options;

  const csvParts: string[] = [];

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]!;

    if (separatorRow && i > 0) {
      // Add separator between tables
      csvParts.push('');
      csvParts.push(`--- Table ${i + 1} (Page ${table.page}) ---`);
    }

    csvParts.push(tableToCSV(table, { delimiter }));
  }

  return csvParts.join('\n');
}

/**
 * Convert a single table to Excel worksheet format
 *
 * @param table - Extracted table
 * @param sheetName - Optional worksheet name
 * @returns Excel worksheet data
 *
 * @example
 * ```typescript
 * const worksheet = tableToExcel(table, 'Data');
 * // Use with xlsx library: XLSX.utils.aoa_to_sheet(worksheet.data);
 * ```
 */
export function tableToExcel(
  table: ExtractedTable,
  sheetName?: string
): ExcelWorksheet {
  const name = sheetName ?? `Table_Page${table.page}_${table.index + 1}`;

  // Convert string values, attempt to parse numbers
  const data: (string | number | null)[][] = table.rows.map(row =>
    row.map(cell => {
      const trimmed = cell.trim();
      if (!trimmed) return null;

      // Try to parse as number
      const num = parseFloat(trimmed.replace(/,/g, ''));
      if (!isNaN(num) && isFinite(num)) {
        return num;
      }

      return trimmed;
    })
  );

  // Calculate column widths based on content
  const columnWidths = data[0]?.map((_, colIndex) => {
    const maxLength = Math.max(
      ...data.map(row => String(row[colIndex] ?? '').length)
    );
    return Math.min(50, Math.max(10, maxLength + 2));
  }) ?? [];

  // Collect merged cell information
  const merges: ExcelWorksheet['merges'] = [];

  for (let rowIndex = 0; rowIndex < table.cells.length; rowIndex++) {
    for (let colIndex = 0; colIndex < table.cells[rowIndex]!.length; colIndex++) {
      const cell = table.cells[rowIndex]![colIndex]!;
      if (cell.rowSpan > 1 || cell.colSpan > 1) {
        merges.push({
          startRow: rowIndex,
          endRow: rowIndex + cell.rowSpan - 1,
          startCol: colIndex,
          endCol: colIndex + cell.colSpan - 1,
        });
      }
    }
  }

  return {
    name,
    data,
    columnWidths,
    merges: merges.length > 0 ? merges : undefined,
  };
}

/**
 * Convert multiple tables to Excel workbook format
 *
 * @param tables - Array of extracted tables
 * @returns Excel workbook data
 *
 * @example
 * ```typescript
 * const workbook = tablesToExcel(tables);
 * // Use with xlsx library to create actual Excel file
 * ```
 */
export function tablesToExcel(tables: ExtractedTable[]): ExcelWorkbook {
  const sheets: ExcelWorksheet[] = tables.map((table, index) => {
    const sheetName = tables.length > 1
      ? `Table_${index + 1}_Page${table.page}`
      : `Table_Page${table.page}`;
    return tableToExcel(table, sheetName);
  });

  return { sheets };
}

/**
 * Convert a table to JSON format
 *
 * @param table - Extracted table
 * @param options - JSON options
 * @returns Array of objects (if headers) or array of arrays
 *
 * @example
 * ```typescript
 * const json = tableToJSON(table, { useHeaders: true });
 * console.log(JSON.stringify(json, null, 2));
 * ```
 */
export function tableToJSON(
  table: ExtractedTable,
  options: { useHeaders?: boolean; pretty?: boolean } = {}
): object[] | string[][] {
  const { useHeaders = true } = options;

  if (useHeaders && table.headerRows.length > 0 && table.rows.length > 1) {
    // Use first header row as keys
    const headerRow = table.rows[table.headerRows[0]!]!;
    const dataRows = table.rows.slice(Math.max(...table.headerRows) + 1);

    return dataRows.map(row => {
      const obj: Record<string, string> = {};
      headerRow.forEach((header, index) => {
        const key = header.trim() || `Column_${index + 1}`;
        obj[key] = row[index] ?? '';
      });
      return obj;
    });
  }

  return table.rows;
}

/**
 * Convert multiple tables to JSON format
 *
 * @param tables - Array of extracted tables
 * @param options - JSON options
 * @returns Object with tables array
 */
export function tablesToJSON(
  tables: ExtractedTable[],
  options: { useHeaders?: boolean } = {}
): { tables: Array<{ page: number; index: number; data: object[] | string[][] }> } {
  return {
    tables: tables.map(table => ({
      page: table.page,
      index: table.index,
      data: tableToJSON(table, options),
    })),
  };
}

/**
 * Get count of tables in a PDF without extracting them
 *
 * @param pdf - PDF.js document proxy
 * @param options - Options for detection
 * @returns Promise with table count per page and total
 */
export async function getTableCount(
  pdf: PDFDocumentProxy,
  options: Pick<ExtractTablesOptions, 'pages' | 'minConfidence' | 'onProgress'> = {}
): Promise<TableCountResult> {
  const regions = await detectTableRegions(pdf, options);

  const perPage: { page: number; count: number }[] = [];
  const pageMap = new Map<number, number>();

  for (const region of regions) {
    pageMap.set(region.page, (pageMap.get(region.page) ?? 0) + 1);
  }

  for (const [page, count] of pageMap.entries()) {
    perPage.push({ page, count });
  }

  perPage.sort((a, b) => a.page - b.page);

  return {
    total: regions.length,
    perPage,
  };
}

/**
 * Create a filename for an extracted table
 *
 * @param table - Extracted table
 * @param format - File format extension
 * @param prefix - Filename prefix
 * @returns Generated filename
 */
export function createTableFilename(
  table: ExtractedTable,
  format: 'csv' | 'xlsx' | 'json' = 'csv',
  prefix = 'table'
): string {
  return `${prefix}_page${table.page}_${table.index + 1}.${format}`;
}
