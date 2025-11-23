/**
 * Key Information Extraction for @pdflover/pdf-core
 *
 * Extracts structured information from PDF text content including:
 * dates, monetary amounts, names, emails, phones, addresses, URLs, and IDs.
 * All processing runs in the browser - no server uploads required.
 */

import type { ProgressCallback, ProcessingResult } from '@pdflover/shared';
import { createProgressReporter, measureTime } from './utils.js';

/**
 * Bounding box for located text
 */
export interface TextLocation {
  /** Page number (1-indexed) */
  page: number;
  /** Start character index in the page text */
  startIndex: number;
  /** End character index in the page text */
  endIndex: number;
  /** The matched text */
  text: string;
}

/**
 * Extracted date with format information
 */
export interface ExtractedDate {
  /** Unique identifier */
  id: string;
  /** The original text that was matched */
  original: string;
  /** Parsed Date object (if parseable) */
  parsed?: Date;
  /** Detected format */
  format: DateFormat;
  /** Confidence score (0-100) */
  confidence: number;
  /** Location in document */
  location: TextLocation;
}

/**
 * Supported date formats
 */
export type DateFormat =
  | 'ISO' // 2024-01-15
  | 'US' // 01/15/2024 or 1/15/2024
  | 'EU' // 15/01/2024 or 15.01.2024
  | 'LONG' // January 15, 2024
  | 'SHORT' // Jan 15, 2024
  | 'RELATIVE' // yesterday, last week
  | 'UNKNOWN';

/**
 * Extracted monetary amount
 */
export interface ExtractedAmount {
  /** Unique identifier */
  id: string;
  /** The original text that was matched */
  original: string;
  /** Numeric value */
  value: number;
  /** Currency code (USD, EUR, GBP, etc.) */
  currency: string;
  /** Currency symbol used in original text */
  symbol?: string;
  /** Confidence score (0-100) */
  confidence: number;
  /** Location in document */
  location: TextLocation;
}

/**
 * Extracted person name
 */
export interface ExtractedName {
  /** Unique identifier */
  id: string;
  /** The full matched name */
  fullName: string;
  /** First name (if detectable) */
  firstName?: string;
  /** Last name (if detectable) */
  lastName?: string;
  /** Title/prefix (Mr., Mrs., Dr., etc.) */
  title?: string;
  /** Suffix (Jr., Sr., III, etc.) */
  suffix?: string;
  /** Confidence score (0-100) */
  confidence: number;
  /** Location in document */
  location: TextLocation;
}

/**
 * Extracted email address
 */
export interface ExtractedEmail {
  /** Unique identifier */
  id: string;
  /** The email address */
  email: string;
  /** Domain part of the email */
  domain: string;
  /** Local part (before @) */
  localPart: string;
  /** Confidence score (0-100) */
  confidence: number;
  /** Location in document */
  location: TextLocation;
}

/**
 * Extracted phone number
 */
export interface ExtractedPhone {
  /** Unique identifier */
  id: string;
  /** The original text that was matched */
  original: string;
  /** Normalized phone number (digits only) */
  normalized: string;
  /** Country code (if detected) */
  countryCode?: string;
  /** Detected format type */
  format: PhoneFormat;
  /** Confidence score (0-100) */
  confidence: number;
  /** Location in document */
  location: TextLocation;
}

/**
 * Phone number format types
 */
export type PhoneFormat =
  | 'US' // (555) 123-4567
  | 'INTERNATIONAL' // +1 555 123 4567
  | 'DOTTED' // 555.123.4567
  | 'DASHED' // 555-123-4567
  | 'COMPACT' // 5551234567
  | 'UNKNOWN';

/**
 * Extracted physical address
 */
export interface ExtractedAddress {
  /** Unique identifier */
  id: string;
  /** The full matched address text */
  fullAddress: string;
  /** Street address */
  street?: string;
  /** City */
  city?: string;
  /** State/Province */
  state?: string;
  /** Postal/ZIP code */
  postalCode?: string;
  /** Country */
  country?: string;
  /** Confidence score (0-100) */
  confidence: number;
  /** Location in document */
  location: TextLocation;
}

/**
 * Extracted URL
 */
export interface ExtractedURL {
  /** Unique identifier */
  id: string;
  /** The full URL */
  url: string;
  /** Protocol (http, https, ftp, etc.) */
  protocol?: string;
  /** Domain/hostname */
  domain: string;
  /** Path portion */
  path?: string;
  /** Whether it's a secure URL (https) */
  isSecure: boolean;
  /** Confidence score (0-100) */
  confidence: number;
  /** Location in document */
  location: TextLocation;
}

/**
 * Extracted ID/Reference number
 */
export interface ExtractedID {
  /** Unique identifier */
  id: string;
  /** The original text that was matched */
  original: string;
  /** Type of ID */
  type: IDType;
  /** Normalized value (if applicable) */
  normalized?: string;
  /** Whether format validation passed */
  isValid: boolean;
  /** Confidence score (0-100) */
  confidence: number;
  /** Location in document */
  location: TextLocation;
}

/**
 * Types of IDs that can be detected
 */
export type IDType =
  | 'SSN' // Social Security Number (US)
  | 'EIN' // Employer Identification Number
  | 'INVOICE' // Invoice number
  | 'ORDER' // Order number
  | 'ACCOUNT' // Account number
  | 'REFERENCE' // Reference number
  | 'TRACKING' // Tracking number
  | 'LICENSE' // License number
  | 'PASSPORT' // Passport number
  | 'ITIN' // Individual Taxpayer ID
  | 'UNKNOWN';

/**
 * Custom pattern definition
 */
export interface CustomPattern {
  /** Name/label for this pattern */
  name: string;
  /** Regular expression pattern */
  pattern: RegExp;
  /** Optional description */
  description?: string;
}

/**
 * Custom pattern match result
 */
export interface CustomPatternMatch {
  /** Unique identifier */
  id: string;
  /** Pattern name */
  patternName: string;
  /** Matched text */
  match: string;
  /** Capture groups (if any) */
  groups?: Record<string, string>;
  /** Confidence score (0-100) */
  confidence: number;
  /** Location in document */
  location: TextLocation;
}

/**
 * Complete extracted information from a document
 */
export interface ExtractedInfo {
  /** Extracted dates */
  dates: ExtractedDate[];
  /** Extracted monetary amounts */
  amounts: ExtractedAmount[];
  /** Extracted person names */
  names: ExtractedName[];
  /** Extracted email addresses */
  emails: ExtractedEmail[];
  /** Extracted phone numbers */
  phones: ExtractedPhone[];
  /** Extracted physical addresses */
  addresses: ExtractedAddress[];
  /** Extracted URLs */
  urls: ExtractedURL[];
  /** Extracted IDs and reference numbers */
  ids: ExtractedID[];
  /** Custom pattern matches */
  customMatches: CustomPatternMatch[];
  /** Summary statistics */
  summary: ExtractionSummary;
  /** Total processing time in milliseconds */
  processingTime: number;
}

/**
 * Summary statistics for extraction results
 */
export interface ExtractionSummary {
  /** Total items extracted */
  totalItems: number;
  /** Count by type */
  counts: {
    dates: number;
    amounts: number;
    names: number;
    emails: number;
    phones: number;
    addresses: number;
    urls: number;
    ids: number;
    customMatches: number;
  };
  /** Total monetary value (sum of amounts in USD) */
  totalAmountUSD?: number;
  /** Date range (earliest and latest dates found) */
  dateRange?: {
    earliest?: Date;
    latest?: Date;
  };
  /** Unique domains from emails and URLs */
  uniqueDomains: string[];
  /** Pages with extractions */
  pagesWithContent: number[];
}

/**
 * Options for key information extraction
 */
export interface ExtractInfoOptions {
  /** Extract dates (default: true) */
  extractDates?: boolean;
  /** Extract amounts (default: true) */
  extractAmounts?: boolean;
  /** Extract names (default: true) */
  extractNames?: boolean;
  /** Extract emails (default: true) */
  extractEmails?: boolean;
  /** Extract phones (default: true) */
  extractPhones?: boolean;
  /** Extract addresses (default: true) */
  extractAddresses?: boolean;
  /** Extract URLs (default: true) */
  extractURLs?: boolean;
  /** Extract IDs (default: true) */
  extractIDs?: boolean;
  /** Custom patterns to match */
  customPatterns?: CustomPattern[];
  /** Minimum confidence threshold (0-100, default: 50) */
  minConfidence?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Page text content for extraction
 */
export interface PageText {
  /** Page number (1-indexed) */
  page: number;
  /** Text content of the page */
  text: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

let idCounter = 0;

/**
 * Generate a unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

/**
 * Create a text location object
 */
function createLocation(page: number, text: string, startIndex: number): TextLocation {
  return {
    page,
    startIndex,
    endIndex: startIndex + text.length,
    text,
  };
}

// ============================================================================
// Date Extraction
// ============================================================================

/**
 * Regular expressions for various date formats
 */
const DATE_PATTERNS = {
  // ISO format: 2024-01-15, 2024/01/15
  ISO: /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g,

  // US format: 01/15/2024, 1/15/24, 01-15-2024
  US: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/g,

  // EU format with dots: 15.01.2024
  EU_DOT: /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g,

  // Long format: January 15, 2024 or January 15th, 2024
  LONG: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi,

  // Short format: Jan 15, 2024 or Jan. 15, 2024
  SHORT: /\b(Jan\.?|Feb\.?|Mar\.?|Apr\.?|May|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Sept\.?|Oct\.?|Nov\.?|Dec\.?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi,

  // Day-Month-Year written: 15 January 2024
  DMY_WRITTEN: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,

  // Month-Year: January 2024
  MONTH_YEAR: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,
};

const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

/**
 * Extract all dates from text
 *
 * @param text - Text to search for dates
 * @param page - Page number for location tracking
 * @returns Array of extracted dates
 *
 * @example
 * ```typescript
 * const dates = extractDates("Meeting on January 15, 2024", 1);
 * console.log(dates[0].parsed); // Date object
 * ```
 */
export function extractDates(text: string, page: number = 1): ExtractedDate[] {
  const results: ExtractedDate[] = [];
  const seen = new Set<string>();

  // ISO format
  let match: RegExpExecArray | null;
  const isoPattern = new RegExp(DATE_PATTERNS.ISO.source, 'g');
  while ((match = isoPattern.exec(text)) !== null) {
    const key = `${match.index}-${match[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const [, year, month, day] = match;
    const parsed = new Date(parseInt(year!), parseInt(month!) - 1, parseInt(day!));
    if (!isNaN(parsed.getTime())) {
      results.push({
        id: generateId('date'),
        original: match[0],
        parsed,
        format: 'ISO',
        confidence: 95,
        location: createLocation(page, match[0], match.index),
      });
    }
  }

  // Long format (January 15, 2024)
  const longPattern = new RegExp(DATE_PATTERNS.LONG.source, 'gi');
  while ((match = longPattern.exec(text)) !== null) {
    const key = `${match.index}-${match[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const [, monthName, day, year] = match;
    const monthIndex = MONTH_MAP[monthName!.toLowerCase()];
    if (monthIndex !== undefined) {
      const parsed = new Date(parseInt(year!), monthIndex, parseInt(day!));
      if (!isNaN(parsed.getTime())) {
        results.push({
          id: generateId('date'),
          original: match[0],
          parsed,
          format: 'LONG',
          confidence: 90,
          location: createLocation(page, match[0], match.index),
        });
      }
    }
  }

  // Short format (Jan 15, 2024)
  const shortPattern = new RegExp(DATE_PATTERNS.SHORT.source, 'gi');
  while ((match = shortPattern.exec(text)) !== null) {
    const key = `${match.index}-${match[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const [, monthName, day, year] = match;
    const cleanMonth = monthName!.replace('.', '').toLowerCase();
    const monthIndex = MONTH_MAP[cleanMonth];
    if (monthIndex !== undefined) {
      const parsed = new Date(parseInt(year!), monthIndex, parseInt(day!));
      if (!isNaN(parsed.getTime())) {
        results.push({
          id: generateId('date'),
          original: match[0],
          parsed,
          format: 'SHORT',
          confidence: 85,
          location: createLocation(page, match[0], match.index),
        });
      }
    }
  }

  // DMY written format (15 January 2024)
  const dmyPattern = new RegExp(DATE_PATTERNS.DMY_WRITTEN.source, 'gi');
  while ((match = dmyPattern.exec(text)) !== null) {
    const key = `${match.index}-${match[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const [, day, monthName, year] = match;
    const monthIndex = MONTH_MAP[monthName!.toLowerCase()];
    if (monthIndex !== undefined) {
      const parsed = new Date(parseInt(year!), monthIndex, parseInt(day!));
      if (!isNaN(parsed.getTime())) {
        results.push({
          id: generateId('date'),
          original: match[0],
          parsed,
          format: 'LONG',
          confidence: 88,
          location: createLocation(page, match[0], match.index),
        });
      }
    }
  }

  // US format (be careful to avoid false positives)
  const usPattern = new RegExp(DATE_PATTERNS.US.source, 'g');
  while ((match = usPattern.exec(text)) !== null) {
    const key = `${match.index}-${match[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const [, month, day, year] = match;
    const monthNum = parseInt(month!);
    const dayNum = parseInt(day!);
    let yearNum = parseInt(year!);

    // Skip if already matched by another pattern
    if (monthNum > 12 || dayNum > 31) continue;

    // Handle 2-digit years
    if (yearNum < 100) {
      yearNum = yearNum > 50 ? 1900 + yearNum : 2000 + yearNum;
    }

    // Validate reasonable year range
    if (yearNum < 1900 || yearNum > 2100) continue;

    const parsed = new Date(yearNum, monthNum - 1, dayNum);
    if (!isNaN(parsed.getTime()) && parsed.getMonth() === monthNum - 1) {
      results.push({
        id: generateId('date'),
        original: match[0],
        parsed,
        format: 'US',
        confidence: 70,
        location: createLocation(page, match[0], match.index),
      });
    }
  }

  // EU format with dots
  const euDotPattern = new RegExp(DATE_PATTERNS.EU_DOT.source, 'g');
  while ((match = euDotPattern.exec(text)) !== null) {
    const key = `${match.index}-${match[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const [, day, month, year] = match;
    const dayNum = parseInt(day!);
    const monthNum = parseInt(month!);
    let yearNum = parseInt(year!);

    if (monthNum > 12 || dayNum > 31) continue;

    if (yearNum < 100) {
      yearNum = yearNum > 50 ? 1900 + yearNum : 2000 + yearNum;
    }

    if (yearNum < 1900 || yearNum > 2100) continue;

    const parsed = new Date(yearNum, monthNum - 1, dayNum);
    if (!isNaN(parsed.getTime()) && parsed.getMonth() === monthNum - 1) {
      results.push({
        id: generateId('date'),
        original: match[0],
        parsed,
        format: 'EU',
        confidence: 70,
        location: createLocation(page, match[0], match.index),
      });
    }
  }

  return results.sort((a, b) => a.location.startIndex - b.location.startIndex);
}

// ============================================================================
// Amount Extraction
// ============================================================================

/**
 * Currency symbols and their codes
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  '$': 'USD',
  'USD': 'USD',
  'US$': 'USD',
  '\u20ac': 'EUR', // Euro symbol
  'EUR': 'EUR',
  '\u00a3': 'GBP', // Pound symbol
  'GBP': 'GBP',
  '\u00a5': 'JPY', // Yen symbol
  'JPY': 'JPY',
  '\u20b9': 'INR', // Indian Rupee
  'INR': 'INR',
  'Rs': 'INR',
  'CAD': 'CAD',
  'C$': 'CAD',
  'AUD': 'AUD',
  'A$': 'AUD',
  'CHF': 'CHF',
  'CNY': 'CNY',
  '\u5143': 'CNY', // Yuan character
};

/**
 * Extract all monetary amounts from text
 *
 * @param text - Text to search for amounts
 * @param page - Page number for location tracking
 * @returns Array of extracted amounts
 *
 * @example
 * ```typescript
 * const amounts = extractAmounts("Total: $1,234.56", 1);
 * console.log(amounts[0].value); // 1234.56
 * ```
 */
export function extractAmounts(text: string, page: number = 1): ExtractedAmount[] {
  const results: ExtractedAmount[] = [];
  const seen = new Set<string>();

  // Pattern for currency + amount
  const pattern = /(?:([$\u20ac\u00a3\u00a5\u20b9]|USD|US\$|EUR|GBP|JPY|INR|Rs\.?|CAD|C\$|AUD|A\$|CHF|CNY|\u5143)\s?)?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?:\s?(USD|EUR|GBP|JPY|INR|CAD|AUD|CHF|CNY))?/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const [fullMatch, prefixSymbol, numberPart, suffixCurrency] = match;

    // Skip if no currency indicator
    const symbol = prefixSymbol || suffixCurrency;
    if (!symbol) continue;

    // Skip very small matches that might be false positives
    if (numberPart!.length < 2) continue;

    const key = `${match.index}-${fullMatch}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Parse the number
    const cleanNumber = numberPart!.replace(/,/g, '');
    const value = parseFloat(cleanNumber);

    if (isNaN(value) || value === 0) continue;

    // Determine currency
    const normalizedSymbol = symbol.toUpperCase().replace('.', '');
    const currency = CURRENCY_SYMBOLS[symbol] || CURRENCY_SYMBOLS[normalizedSymbol] || 'USD';

    results.push({
      id: generateId('amount'),
      original: fullMatch!.trim(),
      value,
      currency,
      symbol: prefixSymbol || undefined,
      confidence: prefixSymbol ? 90 : 75,
      location: createLocation(page, fullMatch!.trim(), match.index),
    });
  }

  return results.sort((a, b) => a.location.startIndex - b.location.startIndex);
}

// ============================================================================
// Name Extraction
// ============================================================================

/**
 * Common name titles/prefixes
 */
const NAME_TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev', 'Sir', 'Dame', 'Lord', 'Lady'];

/**
 * Common name suffixes
 */
const NAME_SUFFIXES = ['Jr', 'Sr', 'II', 'III', 'IV', 'PhD', 'MD', 'Esq', 'CPA', 'DDS', 'DO'];

/**
 * Extract person names from text (basic NER)
 *
 * Uses heuristics to identify potential names:
 * - Capitalized word sequences
 * - Title + Name patterns
 * - Common name patterns
 *
 * @param text - Text to search for names
 * @param page - Page number for location tracking
 * @returns Array of extracted names
 *
 * @example
 * ```typescript
 * const names = extractNames("Contact John Smith for details", 1);
 * console.log(names[0].fullName); // "John Smith"
 * ```
 */
export function extractNames(text: string, page: number = 1): ExtractedName[] {
  const results: ExtractedName[] = [];
  const seen = new Set<string>();

  // Pattern for Title + Name
  const titlePattern = new RegExp(
    `\\b(${NAME_TITLES.join('|')})\\.?\\s+([A-Z][a-z]+)(?:\\s+([A-Z][a-z]+))?(?:\\s+(${NAME_SUFFIXES.join('|')})\\.?)?\\b`,
    'g'
  );

  let match: RegExpExecArray | null;
  while ((match = titlePattern.exec(text)) !== null) {
    const [fullMatch, title, first, last, suffix] = match;
    const key = `${match.index}-${fullMatch}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      id: generateId('name'),
      fullName: fullMatch!.trim(),
      firstName: first,
      lastName: last,
      title: title?.replace('.', ''),
      suffix: suffix?.replace('.', ''),
      confidence: 85,
      location: createLocation(page, fullMatch!.trim(), match.index),
    });
  }

  // Pattern for FirstName LastName (consecutive capitalized words)
  const namePattern = /\b([A-Z][a-z]{1,15})\s+([A-Z][a-z]{1,15})(?:\s+([A-Z][a-z]{1,15}))?\b/g;

  while ((match = namePattern.exec(text)) !== null) {
    const [fullMatch, first, second, third] = match;
    const key = `${match.index}-${fullMatch}`;
    if (seen.has(key)) continue;

    // Skip common false positives (sentence starts, common phrases)
    const commonWords = ['The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'Which', 'Who', 'How', 'New', 'For', 'With', 'From', 'About'];
    if (commonWords.includes(first!) || commonWords.includes(second!)) continue;

    // Check if preceded by sentence-ending punctuation (likely sentence start, not a name)
    const beforeText = text.substring(Math.max(0, match.index - 3), match.index);
    if (/[.!?]\s*$/.test(beforeText) && !seen.has(key)) {
      // Lower confidence for sentence starts
      seen.add(key);
      results.push({
        id: generateId('name'),
        fullName: fullMatch!.trim(),
        firstName: first,
        lastName: third || second,
        confidence: 50,
        location: createLocation(page, fullMatch!.trim(), match.index),
      });
      continue;
    }

    seen.add(key);
    results.push({
      id: generateId('name'),
      fullName: fullMatch!.trim(),
      firstName: first,
      lastName: third || second,
      confidence: 65,
      location: createLocation(page, fullMatch!.trim(), match.index),
    });
  }

  return results.sort((a, b) => a.location.startIndex - b.location.startIndex);
}

// ============================================================================
// Email Extraction
// ============================================================================

/**
 * Extract email addresses from text
 *
 * @param text - Text to search for emails
 * @param page - Page number for location tracking
 * @returns Array of extracted emails
 *
 * @example
 * ```typescript
 * const emails = extractEmails("Contact us at info@example.com", 1);
 * console.log(emails[0].email); // "info@example.com"
 * ```
 */
export function extractEmails(text: string, page: number = 1): ExtractedEmail[] {
  const results: ExtractedEmail[] = [];
  const seen = new Set<string>();

  // RFC 5322 compliant email pattern (simplified)
  const emailPattern = /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;

  let match: RegExpExecArray | null;
  while ((match = emailPattern.exec(text)) !== null) {
    const [email, localPart, domain] = match;
    const key = email!.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      id: generateId('email'),
      email: email!,
      localPart: localPart!,
      domain: domain!,
      confidence: 95,
      location: createLocation(page, email!, match.index),
    });
  }

  return results;
}

// ============================================================================
// Phone Extraction
// ============================================================================

/**
 * Extract phone numbers from text
 *
 * Supports various formats:
 * - US: (555) 123-4567, 555-123-4567
 * - International: +1 555 123 4567
 * - Dotted: 555.123.4567
 *
 * @param text - Text to search for phone numbers
 * @param page - Page number for location tracking
 * @returns Array of extracted phone numbers
 *
 * @example
 * ```typescript
 * const phones = extractPhones("Call us at (555) 123-4567", 1);
 * console.log(phones[0].normalized); // "5551234567"
 * ```
 */
export function extractPhones(text: string, page: number = 1): ExtractedPhone[] {
  const results: ExtractedPhone[] = [];
  const seen = new Set<string>();

  const phonePatterns = [
    // International format: +1 555 123 4567 or +1-555-123-4567
    { pattern: /\+(\d{1,3})[-.\s]?(\d{2,4})[-.\s]?(\d{3,4})[-.\s]?(\d{3,4})\b/g, format: 'INTERNATIONAL' as PhoneFormat },
    // US format: (555) 123-4567
    { pattern: /\((\d{3})\)\s*(\d{3})[-.]?(\d{4})\b/g, format: 'US' as PhoneFormat },
    // Dashed: 555-123-4567
    { pattern: /\b(\d{3})-(\d{3})-(\d{4})\b/g, format: 'DASHED' as PhoneFormat },
    // Dotted: 555.123.4567
    { pattern: /\b(\d{3})\.(\d{3})\.(\d{4})\b/g, format: 'DOTTED' as PhoneFormat },
    // Spaced: 555 123 4567
    { pattern: /\b(\d{3})\s(\d{3})\s(\d{4})\b/g, format: 'UNKNOWN' as PhoneFormat },
  ];

  for (const { pattern, format } of phonePatterns) {
    const regex = new RegExp(pattern.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const normalized = fullMatch.replace(/\D/g, '');

      // Skip if too short or too long
      if (normalized.length < 10 || normalized.length > 15) continue;

      const key = normalized;
      if (seen.has(key)) continue;
      seen.add(key);

      let countryCode: string | undefined;
      if (format === 'INTERNATIONAL' && match[1]) {
        countryCode = match[1];
      }

      results.push({
        id: generateId('phone'),
        original: fullMatch,
        normalized,
        countryCode,
        format,
        confidence: format === 'US' || format === 'INTERNATIONAL' ? 90 : 75,
        location: createLocation(page, fullMatch, match.index),
      });
    }
  }

  return results.sort((a, b) => a.location.startIndex - b.location.startIndex);
}

// ============================================================================
// Address Extraction
// ============================================================================

/**
 * US State abbreviations
 */
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

/**
 * Extract physical addresses from text
 *
 * @param text - Text to search for addresses
 * @param page - Page number for location tracking
 * @returns Array of extracted addresses
 *
 * @example
 * ```typescript
 * const addresses = extractAddresses("Ship to: 123 Main St, Boston, MA 02101", 1);
 * console.log(addresses[0].city); // "Boston"
 * ```
 */
export function extractAddresses(text: string, page: number = 1): ExtractedAddress[] {
  const results: ExtractedAddress[] = [];
  const seen = new Set<string>();

  // US Address pattern: Street, City, State ZIP
  const usAddressPattern = new RegExp(
    `(\\d+\\s+[A-Za-z0-9\\s,.-]+(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Rd|Road|Ln|Lane|Way|Ct|Court|Pl|Place|Cir|Circle)\\.?)\\s*,?\\s*([A-Za-z\\s]+),?\\s*(${US_STATES.join('|')})\\s*(\\d{5}(?:-\\d{4})?)`,
    'gi'
  );

  let match: RegExpExecArray | null;
  while ((match = usAddressPattern.exec(text)) !== null) {
    const [fullMatch, street, city, state, zip] = match;
    const key = fullMatch!.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      id: generateId('address'),
      fullAddress: fullMatch!.trim(),
      street: street?.trim(),
      city: city?.trim(),
      state: state?.toUpperCase(),
      postalCode: zip,
      country: 'USA',
      confidence: 85,
      location: createLocation(page, fullMatch!.trim(), match.index),
    });
  }

  // Simple ZIP code pattern for partial addresses
  const zipRegex = new RegExp(
    `\\b([A-Za-z][A-Za-z\\s]{2,25}),?\\s*(${US_STATES.join('|')})\\s+(\\d{5}(?:-\\d{4})?)\\b`,
    'gi'
  );

  while ((match = zipRegex.exec(text)) !== null) {
    const [fullMatch, city, state, zip] = match;
    const key = fullMatch!.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      id: generateId('address'),
      fullAddress: fullMatch!.trim(),
      city: city?.trim(),
      state: state?.toUpperCase(),
      postalCode: zip,
      country: 'USA',
      confidence: 70,
      location: createLocation(page, fullMatch!.trim(), match.index),
    });
  }

  return results.sort((a, b) => a.location.startIndex - b.location.startIndex);
}

// ============================================================================
// URL Extraction
// ============================================================================

/**
 * Extract URLs from text
 *
 * @param text - Text to search for URLs
 * @param page - Page number for location tracking
 * @returns Array of extracted URLs
 *
 * @example
 * ```typescript
 * const urls = extractURLs("Visit https://example.com for more info", 1);
 * console.log(urls[0].domain); // "example.com"
 * ```
 */
export function extractURLs(text: string, page: number = 1): ExtractedURL[] {
  const results: ExtractedURL[] = [];
  const seen = new Set<string>();

  // URL pattern
  const urlPattern = /\b((?:https?|ftp):\/\/)?(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+)(\/[^\s<>"{}|\\^`\[\]]*)?/gi;

  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    const [fullMatch, protocol, domain, path] = match;

    // Skip email domains
    if (text[match.index - 1] === '@') continue;

    // Require at least a recognizable TLD
    if (!/\.(com|org|net|edu|gov|io|co|me|info|biz|us|uk|ca|de|fr|app|dev|ai|tech|xyz|online)$/i.test(domain!)) {
      continue;
    }

    const url = fullMatch!.trim();
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      id: generateId('url'),
      url,
      protocol: protocol?.replace('://', '') || undefined,
      domain: domain!,
      path: path || undefined,
      isSecure: protocol?.toLowerCase() === 'https://',
      confidence: protocol ? 95 : 80,
      location: createLocation(page, url, match.index),
    });
  }

  return results;
}

// ============================================================================
// ID Extraction
// ============================================================================

/**
 * Extract IDs and reference numbers from text
 *
 * Supports:
 * - SSN (Social Security Numbers)
 * - EIN (Employer Identification Numbers)
 * - Invoice numbers
 * - Order numbers
 * - Account numbers
 * - Reference numbers
 * - Tracking numbers
 *
 * @param text - Text to search for IDs
 * @param page - Page number for location tracking
 * @returns Array of extracted IDs
 *
 * @example
 * ```typescript
 * const ids = extractIDs("Invoice #INV-2024-001", 1);
 * console.log(ids[0].type); // "INVOICE"
 * ```
 */
export function extractIDs(text: string, page: number = 1): ExtractedID[] {
  const results: ExtractedID[] = [];
  const seen = new Set<string>();

  const idPatterns: Array<{ pattern: RegExp; type: IDType; validate?: (match: string) => boolean }> = [
    // SSN: 123-45-6789 or 123 45 6789
    {
      pattern: /\b(\d{3})[-\s](\d{2})[-\s](\d{4})\b/g,
      type: 'SSN',
      validate: (match) => {
        const digits = match.replace(/\D/g, '');
        // Basic SSN validation (not all zeros, valid area number)
        return digits.length === 9 &&
          digits !== '000000000' &&
          !digits.startsWith('000') &&
          !digits.startsWith('666') &&
          !digits.startsWith('9');
      },
    },
    // EIN: 12-3456789
    {
      pattern: /\b(\d{2})-(\d{7})\b/g,
      type: 'EIN',
    },
    // Invoice number patterns
    {
      pattern: /\b(?:Invoice|INV|Inv)[#:\s-]*([A-Z0-9]+-?\d+|\d{4,})\b/gi,
      type: 'INVOICE',
    },
    // Order number patterns
    {
      pattern: /\b(?:Order|ORD|PO)[#:\s-]*([A-Z0-9]+-?\d+|\d{4,})\b/gi,
      type: 'ORDER',
    },
    // Account number patterns
    {
      pattern: /\b(?:Account|Acct|A\/C)[#:\s-]*([A-Z0-9-]{6,})\b/gi,
      type: 'ACCOUNT',
    },
    // Reference number patterns
    {
      pattern: /\b(?:Reference|Ref|REF)[#:\s-]*([A-Z0-9-]{5,})\b/gi,
      type: 'REFERENCE',
    },
    // Tracking number patterns (common carriers)
    {
      pattern: /\b(?:Tracking|Track)[#:\s-]*(\d{10,}|[A-Z]{2}\d{9}[A-Z]{2}|1Z[A-Z0-9]{16})\b/gi,
      type: 'TRACKING',
    },
    // Generic ID patterns with prefixes
    {
      pattern: /\b(?:ID|License|Lic|Passport)[#:\s-]*([A-Z0-9-]{5,})\b/gi,
      type: 'REFERENCE',
    },
  ];

  for (const { pattern, type, validate } of idPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const key = `${type}-${fullMatch.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const isValid = validate ? validate(fullMatch) : true;

      results.push({
        id: generateId('id'),
        original: fullMatch,
        type,
        normalized: fullMatch.replace(/[^A-Z0-9]/gi, ''),
        isValid,
        confidence: isValid ? 80 : 50,
        location: createLocation(page, fullMatch, match.index),
      });
    }
  }

  return results.sort((a, b) => a.location.startIndex - b.location.startIndex);
}

// ============================================================================
// Custom Pattern Extraction
// ============================================================================

/**
 * Extract matches for user-defined patterns
 *
 * @param text - Text to search
 * @param patterns - Array of custom patterns
 * @param page - Page number for location tracking
 * @returns Array of custom pattern matches
 *
 * @example
 * ```typescript
 * const patterns = [
 *   { name: 'Product Code', pattern: /SKU-\d{6}/g }
 * ];
 * const matches = extractCustomPatterns("Order SKU-123456", patterns, 1);
 * ```
 */
export function extractCustomPatterns(
  text: string,
  patterns: CustomPattern[],
  page: number = 1
): CustomPatternMatch[] {
  const results: CustomPatternMatch[] = [];

  for (const { name, pattern } of patterns) {
    // Create a new regex instance to avoid state issues
    const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const groups: Record<string, string> = {};

      // Extract named groups if available
      if (match.groups) {
        Object.assign(groups, match.groups);
      }

      // Also include numbered groups
      for (let i = 1; i < match.length; i++) {
        if (match[i]) {
          groups[`$${i}`] = match[i]!;
        }
      }

      results.push({
        id: generateId('custom'),
        patternName: name,
        match: match[0],
        groups: Object.keys(groups).length > 0 ? groups : undefined,
        confidence: 90,
        location: createLocation(page, match[0], match.index),
      });
    }
  }

  return results.sort((a, b) => a.location.startIndex - b.location.startIndex);
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Exchange rates for converting to USD (approximate)
 */
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.09,
  GBP: 1.27,
  JPY: 0.0067,
  INR: 0.012,
  CAD: 0.74,
  AUD: 0.65,
  CHF: 1.13,
  CNY: 0.14,
};

/**
 * Extract all key information from PDF text content
 *
 * This is the main entry point for extracting structured information
 * from PDF documents. It processes each page and extracts dates,
 * amounts, names, emails, phones, addresses, URLs, and IDs.
 *
 * @param pages - Array of page text content
 * @param options - Extraction options
 * @returns Complete extracted information
 *
 * @example
 * ```typescript
 * const pages = [
 *   { page: 1, text: "Invoice #2024-001 for John Smith..." }
 * ];
 * const result = await extractKeyInformation(pages, {
 *   extractDates: true,
 *   extractAmounts: true,
 *   minConfidence: 60
 * });
 * console.log(result.data?.dates);
 * ```
 */
export async function extractKeyInformation(
  pages: PageText[],
  options: ExtractInfoOptions = {}
): Promise<ProcessingResult<ExtractedInfo>> {
  const {
    extractDates: shouldExtractDates = true,
    extractAmounts: shouldExtractAmounts = true,
    extractNames: shouldExtractNames = true,
    extractEmails: shouldExtractEmails = true,
    extractPhones: shouldExtractPhones = true,
    extractAddresses: shouldExtractAddresses = true,
    extractURLs: shouldExtractURLs = true,
    extractIDs: shouldExtractIDs = true,
    customPatterns = [],
    minConfidence = 50,
    onProgress,
  } = options;

  const stages = ['Extracting dates', 'Extracting amounts', 'Extracting contacts', 'Extracting references', 'Finalizing'];
  const reportProgress = createProgressReporter(onProgress, stages);

  try {
    const { result, duration } = await measureTime(async () => {
      const allDates: ExtractedDate[] = [];
      const allAmounts: ExtractedAmount[] = [];
      const allNames: ExtractedName[] = [];
      const allEmails: ExtractedEmail[] = [];
      const allPhones: ExtractedPhone[] = [];
      const allAddresses: ExtractedAddress[] = [];
      const allUrls: ExtractedURL[] = [];
      const allIds: ExtractedID[] = [];
      const allCustomMatches: CustomPatternMatch[] = [];
      const pagesWithContent: Set<number> = new Set();

      // Stage 1: Dates
      reportProgress(0, 0);
      if (shouldExtractDates) {
        for (const { page, text } of pages) {
          const dates = extractDates(text, page);
          dates.forEach((d) => {
            if (d.confidence >= minConfidence) {
              allDates.push(d);
              pagesWithContent.add(page);
            }
          });
        }
      }
      reportProgress(0, 100);

      // Stage 2: Amounts
      reportProgress(1, 0);
      if (shouldExtractAmounts) {
        for (const { page, text } of pages) {
          const amounts = extractAmounts(text, page);
          amounts.forEach((a) => {
            if (a.confidence >= minConfidence) {
              allAmounts.push(a);
              pagesWithContent.add(page);
            }
          });
        }
      }
      reportProgress(1, 100);

      // Stage 3: Contacts (names, emails, phones)
      reportProgress(2, 0);
      for (const { page, text } of pages) {
        if (shouldExtractNames) {
          const names = extractNames(text, page);
          names.forEach((n) => {
            if (n.confidence >= minConfidence) {
              allNames.push(n);
              pagesWithContent.add(page);
            }
          });
        }
        if (shouldExtractEmails) {
          const emails = extractEmails(text, page);
          emails.forEach((e) => {
            if (e.confidence >= minConfidence) {
              allEmails.push(e);
              pagesWithContent.add(page);
            }
          });
        }
        if (shouldExtractPhones) {
          const phones = extractPhones(text, page);
          phones.forEach((p) => {
            if (p.confidence >= minConfidence) {
              allPhones.push(p);
              pagesWithContent.add(page);
            }
          });
        }
      }
      reportProgress(2, 100);

      // Stage 4: References (addresses, URLs, IDs, custom)
      reportProgress(3, 0);
      for (const { page, text } of pages) {
        if (shouldExtractAddresses) {
          const addresses = extractAddresses(text, page);
          addresses.forEach((a) => {
            if (a.confidence >= minConfidence) {
              allAddresses.push(a);
              pagesWithContent.add(page);
            }
          });
        }
        if (shouldExtractURLs) {
          const urls = extractURLs(text, page);
          urls.forEach((u) => {
            if (u.confidence >= minConfidence) {
              allUrls.push(u);
              pagesWithContent.add(page);
            }
          });
        }
        if (shouldExtractIDs) {
          const ids = extractIDs(text, page);
          ids.forEach((i) => {
            if (i.confidence >= minConfidence) {
              allIds.push(i);
              pagesWithContent.add(page);
            }
          });
        }
        if (customPatterns.length > 0) {
          const customMatches = extractCustomPatterns(text, customPatterns, page);
          customMatches.forEach((m) => {
            if (m.confidence >= minConfidence) {
              allCustomMatches.push(m);
              pagesWithContent.add(page);
            }
          });
        }
      }
      reportProgress(3, 100);

      // Stage 5: Build summary
      reportProgress(4, 0);

      // Calculate total amount in USD
      let totalAmountUSD: number | undefined;
      if (allAmounts.length > 0) {
        totalAmountUSD = allAmounts.reduce((sum, amount) => {
          const rate = EXCHANGE_RATES[amount.currency] || 1;
          return sum + (amount.value * rate);
        }, 0);
      }

      // Find date range
      let dateRange: { earliest?: Date; latest?: Date } | undefined;
      const parsedDates = allDates
        .filter((d) => d.parsed)
        .map((d) => d.parsed!.getTime())
        .sort((a, b) => a - b);

      if (parsedDates.length > 0) {
        dateRange = {
          earliest: new Date(parsedDates[0]!),
          latest: new Date(parsedDates[parsedDates.length - 1]!),
        };
      }

      // Collect unique domains
      const domains = new Set<string>();
      allEmails.forEach((e) => domains.add(e.domain.toLowerCase()));
      allUrls.forEach((u) => domains.add(u.domain.toLowerCase()));

      const summary: ExtractionSummary = {
        totalItems:
          allDates.length +
          allAmounts.length +
          allNames.length +
          allEmails.length +
          allPhones.length +
          allAddresses.length +
          allUrls.length +
          allIds.length +
          allCustomMatches.length,
        counts: {
          dates: allDates.length,
          amounts: allAmounts.length,
          names: allNames.length,
          emails: allEmails.length,
          phones: allPhones.length,
          addresses: allAddresses.length,
          urls: allUrls.length,
          ids: allIds.length,
          customMatches: allCustomMatches.length,
        },
        totalAmountUSD,
        dateRange,
        uniqueDomains: Array.from(domains).sort(),
        pagesWithContent: Array.from(pagesWithContent).sort((a, b) => a - b),
      };

      reportProgress(4, 100);

      return {
        dates: allDates,
        amounts: allAmounts,
        names: allNames,
        emails: allEmails,
        phones: allPhones,
        addresses: allAddresses,
        urls: allUrls,
        ids: allIds,
        customMatches: allCustomMatches,
        summary,
        processingTime: 0, // Will be set by measureTime
      };
    });

    return {
      success: true,
      data: { ...result, processingTime: duration },
      duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Extraction failed';
    return {
      success: false,
      error: errorMessage,
      errorCode: 'UNKNOWN_ERROR',
      duration: 0,
    };
  }
}

/**
 * Export extracted information to JSON format
 *
 * @param info - Extracted information
 * @returns JSON string
 */
export function exportToJSON(info: ExtractedInfo): string {
  return JSON.stringify(info, null, 2);
}

/**
 * Export extracted information to CSV format
 *
 * @param info - Extracted information
 * @param type - Type of information to export
 * @returns CSV string
 */
export function exportToCSV(
  info: ExtractedInfo,
  type: 'dates' | 'amounts' | 'names' | 'emails' | 'phones' | 'addresses' | 'urls' | 'ids' | 'all'
): string {
  const rows: string[][] = [];

  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  if (type === 'all' || type === 'dates') {
    rows.push(['Type', 'Value', 'Format', 'Parsed Date', 'Confidence', 'Page']);
    info.dates.forEach((d) => {
      rows.push([
        'Date',
        escapeCSV(d.original),
        d.format,
        d.parsed?.toISOString() || '',
        d.confidence.toString(),
        d.location.page.toString(),
      ]);
    });
  }

  if (type === 'all' || type === 'amounts') {
    if (type === 'all') rows.push([]);
    rows.push(['Type', 'Original', 'Value', 'Currency', 'Confidence', 'Page']);
    info.amounts.forEach((a) => {
      rows.push([
        'Amount',
        escapeCSV(a.original),
        a.value.toString(),
        a.currency,
        a.confidence.toString(),
        a.location.page.toString(),
      ]);
    });
  }

  if (type === 'all' || type === 'emails') {
    if (type === 'all') rows.push([]);
    rows.push(['Type', 'Email', 'Domain', 'Confidence', 'Page']);
    info.emails.forEach((e) => {
      rows.push([
        'Email',
        escapeCSV(e.email),
        e.domain,
        e.confidence.toString(),
        e.location.page.toString(),
      ]);
    });
  }

  if (type === 'all' || type === 'phones') {
    if (type === 'all') rows.push([]);
    rows.push(['Type', 'Phone', 'Normalized', 'Format', 'Confidence', 'Page']);
    info.phones.forEach((p) => {
      rows.push([
        'Phone',
        escapeCSV(p.original),
        p.normalized,
        p.format,
        p.confidence.toString(),
        p.location.page.toString(),
      ]);
    });
  }

  if (type === 'all' || type === 'names') {
    if (type === 'all') rows.push([]);
    rows.push(['Type', 'Full Name', 'First Name', 'Last Name', 'Confidence', 'Page']);
    info.names.forEach((n) => {
      rows.push([
        'Name',
        escapeCSV(n.fullName),
        n.firstName || '',
        n.lastName || '',
        n.confidence.toString(),
        n.location.page.toString(),
      ]);
    });
  }

  if (type === 'all' || type === 'urls') {
    if (type === 'all') rows.push([]);
    rows.push(['Type', 'URL', 'Domain', 'Secure', 'Confidence', 'Page']);
    info.urls.forEach((u) => {
      rows.push([
        'URL',
        escapeCSV(u.url),
        u.domain,
        u.isSecure ? 'Yes' : 'No',
        u.confidence.toString(),
        u.location.page.toString(),
      ]);
    });
  }

  if (type === 'all' || type === 'ids') {
    if (type === 'all') rows.push([]);
    rows.push(['Type', 'ID Type', 'Value', 'Valid', 'Confidence', 'Page']);
    info.ids.forEach((i) => {
      rows.push([
        'ID',
        i.type,
        escapeCSV(i.original),
        i.isValid ? 'Yes' : 'No',
        i.confidence.toString(),
        i.location.page.toString(),
      ]);
    });
  }

  if (type === 'all' || type === 'addresses') {
    if (type === 'all') rows.push([]);
    rows.push(['Type', 'Full Address', 'City', 'State', 'ZIP', 'Confidence', 'Page']);
    info.addresses.forEach((a) => {
      rows.push([
        'Address',
        escapeCSV(a.fullAddress),
        a.city || '',
        a.state || '',
        a.postalCode || '',
        a.confidence.toString(),
        a.location.page.toString(),
      ]);
    });
  }

  return rows.map((row) => row.join(',')).join('\n');
}
