/**
 * Document Classification for @pdflover/pdf-core
 *
 * Provides document type classification capabilities using keyword analysis,
 * structural features, and pattern recognition. All processing runs in the browser.
 */

import type { ProgressCallback } from '@pdflover/shared';
import { createProgressReporter, measureTime } from './utils.js';

/**
 * Document types that can be classified
 */
export type DocumentType =
  | 'invoice'
  | 'contract'
  | 'report'
  | 'resume'
  | 'academic'
  | 'form'
  | 'letter'
  | 'legal'
  | 'financial'
  | 'medical'
  | 'other';

/**
 * Confidence level for classification
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Classification result for a document
 */
export interface Classification {
  /** Primary document type */
  type: DocumentType;
  /** Confidence score (0-100) */
  confidence: number;
  /** Confidence level category */
  confidenceLevel: ConfidenceLevel;
  /** Secondary possible types with their confidence */
  alternatives: Array<{ type: DocumentType; confidence: number }>;
  /** Extracted features that led to the classification */
  features: DocumentFeatures;
  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * Extracted document features for classification
 */
export interface DocumentFeatures {
  /** Domain-specific keywords found */
  keywords: KeywordMatch[];
  /** Document structure information */
  structure: DocumentStructure;
  /** Named entities found in the document */
  entities: ExtractedEntities;
  /** Document metadata */
  metadata: DocumentMetadata;
  /** Text statistics */
  textStats: TextStatistics;
}

/**
 * Keyword match with context
 */
export interface KeywordMatch {
  /** The matched keyword */
  keyword: string;
  /** Category this keyword belongs to */
  category: DocumentType;
  /** Number of occurrences */
  count: number;
  /** Weight for classification */
  weight: number;
}

/**
 * Document structure information
 */
export interface DocumentStructure {
  /** Number of pages */
  pageCount: number;
  /** Whether the document has tables */
  hasTables: boolean;
  /** Whether the document has lists */
  hasLists: boolean;
  /** Whether the document has headers/sections */
  hasSections: boolean;
  /** Whether the document has a signature area */
  hasSignatureArea: boolean;
  /** Whether the document has numbered items */
  hasNumberedItems: boolean;
  /** Average line length */
  averageLineLength: number;
  /** Number of paragraphs */
  paragraphCount: number;
  /** Whether it appears to be a form with fields */
  hasFormFields: boolean;
}

/**
 * Extracted named entities
 */
export interface ExtractedEntities {
  /** Dates found */
  dates: string[];
  /** Monetary amounts */
  amounts: string[];
  /** Email addresses */
  emails: string[];
  /** Phone numbers */
  phones: string[];
  /** Company names (potential) */
  organizations: string[];
  /** Person names (potential) */
  persons: string[];
  /** Addresses */
  addresses: string[];
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  /** Document title */
  title?: string;
  /** Document author */
  author?: string;
  /** Document subject */
  subject?: string;
  /** Document keywords */
  keywords?: string[];
  /** Creation date */
  creationDate?: Date;
  /** Modification date */
  modificationDate?: Date;
  /** Producer software */
  producer?: string;
}

/**
 * Text statistics for analysis
 */
export interface TextStatistics {
  /** Total character count */
  charCount: number;
  /** Total word count */
  wordCount: number;
  /** Total line count */
  lineCount: number;
  /** Average words per line */
  avgWordsPerLine: number;
  /** Percentage of uppercase text */
  uppercaseRatio: number;
  /** Percentage of numeric content */
  numericRatio: number;
}

/**
 * Options for document classification
 */
export interface ClassifyOptions {
  /** Progress callback */
  onProgress?: ProgressCallback;
  /** Whether to extract all features (slower but more accurate) */
  fullAnalysis?: boolean;
  /** Minimum confidence threshold to report alternatives */
  alternativeThreshold?: number;
  /** Maximum number of alternatives to return */
  maxAlternatives?: number;
  /** Custom keyword dictionaries to use */
  customKeywords?: Partial<Record<DocumentType, string[]>>;
}

/**
 * Domain-specific keyword dictionaries for classification
 */
const KEYWORD_DICTIONARIES: Record<DocumentType, string[]> = {
  invoice: [
    'invoice', 'bill', 'payment', 'due date', 'amount due', 'total', 'subtotal',
    'tax', 'invoice number', 'invoice #', 'billing', 'remit', 'qty', 'quantity',
    'unit price', 'line item', 'purchase order', 'po #', 'net', 'gross',
    'vat', 'gst', 'discount', 'balance due', 'paid', 'overdue',
  ],
  contract: [
    'agreement', 'contract', 'party', 'parties', 'whereas', 'hereby', 'herein',
    'terms and conditions', 'effective date', 'termination', 'liability',
    'indemnify', 'confidential', 'binding', 'execute', 'witness', 'signature',
    'obligations', 'breach', 'governing law', 'jurisdiction', 'arbitration',
    'amendment', 'addendum', 'clause', 'article', 'section',
  ],
  report: [
    'report', 'summary', 'analysis', 'findings', 'conclusion', 'recommendation',
    'executive summary', 'introduction', 'methodology', 'results', 'discussion',
    'appendix', 'figure', 'table', 'chart', 'graph', 'data', 'statistics',
    'overview', 'assessment', 'evaluation', 'review', 'quarterly', 'annual',
  ],
  resume: [
    'resume', 'cv', 'curriculum vitae', 'experience', 'education', 'skills',
    'objective', 'career', 'employment', 'work history', 'qualifications',
    'certifications', 'references', 'achievements', 'accomplishments',
    'professional', 'bachelor', 'master', 'degree', 'university', 'college',
    'intern', 'position', 'responsibilities', 'proficient',
  ],
  academic: [
    'abstract', 'introduction', 'methodology', 'literature review', 'hypothesis',
    'research', 'study', 'experiment', 'results', 'discussion', 'conclusion',
    'references', 'bibliography', 'citation', 'peer-reviewed', 'journal',
    'thesis', 'dissertation', 'professor', 'university', 'doi', 'issn', 'isbn',
    'et al', 'fig.', 'vol.', 'pp.', 'ibid',
  ],
  form: [
    'form', 'please print', 'please fill', 'check box', 'checkbox', 'date:',
    'name:', 'address:', 'phone:', 'email:', 'signature:', 'sign here',
    'required', 'optional', 'applicant', 'application', 'submit', 'complete',
    'instructions', 'field', 'blank', 'n/a', 'yes/no', 'select one',
  ],
  letter: [
    'dear', 'sincerely', 'regards', 'yours truly', 'to whom it may concern',
    'respectfully', 'thank you', 'best regards', 'kind regards', 'cordially',
    're:', 'subject:', 'attention:', 'enclosed', 'please find', 'attached',
    'looking forward', 'in response', 'further to', 'hope this finds',
  ],
  legal: [
    'court', 'plaintiff', 'defendant', 'attorney', 'counsel', 'judge',
    'case number', 'docket', 'motion', 'petition', 'affidavit', 'deposition',
    'testimony', 'evidence', 'statute', 'ordinance', 'regulation', 'law',
    'legal', 'verdict', 'judgment', 'appeal', 'summons', 'subpoena',
    'notary', 'sworn', 'certify', 'jurisdiction',
  ],
  financial: [
    'financial', 'statement', 'balance sheet', 'income statement', 'cash flow',
    'assets', 'liabilities', 'equity', 'revenue', 'expenses', 'profit', 'loss',
    'dividend', 'stock', 'share', 'investment', 'portfolio', 'interest',
    'principal', 'amortization', 'depreciation', 'fiscal', 'quarter', 'audit',
    'gaap', 'ifrs', 'cpa', 'accountant',
  ],
  medical: [
    'patient', 'diagnosis', 'treatment', 'prescription', 'medication', 'dose',
    'symptoms', 'medical history', 'allergies', 'physician', 'doctor', 'nurse',
    'hospital', 'clinic', 'lab results', 'blood', 'test', 'vital signs',
    'icd', 'cpt', 'hipaa', 'prognosis', 'chronic', 'acute', 'rx',
    'mg', 'ml', 'injection', 'oral', 'referral',
  ],
  other: [],
};

/**
 * Keyword weights by importance
 */
const KEYWORD_WEIGHTS: Record<string, number> = {
  // High-confidence keywords (weight 3)
  'invoice number': 3, 'invoice #': 3, 'curriculum vitae': 3, 'cv': 3,
  'whereas': 3, 'hereby': 3, 'plaintiff': 3, 'defendant': 3, 'abstract': 3,
  'balance sheet': 3, 'income statement': 3, 'diagnosis': 3, 'prescription': 3,
  // Medium-confidence keywords (weight 2)
  'invoice': 2, 'contract': 2, 'agreement': 2, 'resume': 2, 'report': 2,
  'form': 2, 'dear': 2, 'sincerely': 2, 'court': 2, 'patient': 2,
  // Default weight is 1
};

/**
 * Get the weight for a keyword
 */
function getKeywordWeight(keyword: string): number {
  return KEYWORD_WEIGHTS[keyword.toLowerCase()] ?? 1;
}

/**
 * Detect domain-specific keywords in text
 *
 * @param text - Text to analyze
 * @param customKeywords - Optional custom keyword dictionaries
 * @returns Array of keyword matches with categories
 *
 * @example
 * ```typescript
 * const matches = detectKeywords(pdfText);
 * console.log(matches); // [{ keyword: 'invoice', category: 'invoice', count: 3, weight: 2 }]
 * ```
 */
export function detectKeywords(
  text: string,
  customKeywords?: Partial<Record<DocumentType, string[]>>
): KeywordMatch[] {
  const lowerText = text.toLowerCase();
  const matches: KeywordMatch[] = [];

  // Merge custom keywords with default dictionaries
  const dictionaries = { ...KEYWORD_DICTIONARIES };
  if (customKeywords) {
    for (const [type, keywords] of Object.entries(customKeywords)) {
      const docType = type as DocumentType;
      dictionaries[docType] = [
        ...(dictionaries[docType] || []),
        ...keywords,
      ];
    }
  }

  // Search for keywords in each category
  for (const [category, keywords] of Object.entries(dictionaries)) {
    if (category === 'other') continue;

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      // Use regex to match whole words
      const regex = new RegExp(`\\b${escapeRegex(lowerKeyword)}\\b`, 'gi');
      const matchArray = lowerText.match(regex);

      if (matchArray && matchArray.length > 0) {
        matches.push({
          keyword,
          category: category as DocumentType,
          count: matchArray.length,
          weight: getKeywordWeight(keyword),
        });
      }
    }
  }

  // Sort by weighted score (count * weight)
  return matches.sort((a, b) => (b.count * b.weight) - (a.count * a.weight));
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Analyze document structure from text content
 *
 * @param text - Document text content
 * @param pageCount - Number of pages in the document
 * @returns Document structure information
 */
export function analyzeStructure(text: string, pageCount: number = 1): DocumentStructure {
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  // Detect tables (multiple consecutive lines with consistent separators)
  const hasTables = detectTables(text);

  // Detect lists (lines starting with bullets, numbers, or dashes)
  const listPattern = /^[\s]*[-*\u2022]\s|^[\s]*\d+[.)]\s|^[\s]*[a-z][.)]\s/im;
  const hasLists = lines.some(line => listPattern.test(line));

  // Detect sections (lines that look like headers)
  const headerPattern = /^[\s]*(?:[A-Z][A-Z\s]+$|(?:chapter|section|article)\s+\d+|^\d+\.\s+[A-Z])/im;
  const hasSections = lines.some(line => headerPattern.test(line));

  // Detect signature area
  const signaturePatterns = [
    /signature[\s:_]/i,
    /sign here/i,
    /authorized by/i,
    /signed[\s:_]/i,
    /witness[\s:_]/i,
    /_+\s*date/i,
  ];
  const hasSignatureArea = signaturePatterns.some(pattern => pattern.test(text));

  // Detect numbered items
  const numberedPattern = /^\s*\d+[.)]\s+/m;
  const hasNumberedItems = numberedPattern.test(text);

  // Calculate average line length
  const avgLineLength = lines.length > 0
    ? lines.reduce((sum, line) => sum + line.length, 0) / lines.length
    : 0;

  // Count paragraphs (blocks of text separated by blank lines)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  // Detect form fields (lines with labels followed by blanks or underscores)
  const formFieldPattern = /[a-z]+[\s]*[:_]+[\s]*_*$|[\[\]]\s*[a-z]+|please (fill|print|complete)/i;
  const hasFormFields = formFieldPattern.test(text);

  return {
    pageCount,
    hasTables,
    hasLists,
    hasSections,
    hasSignatureArea,
    hasNumberedItems,
    averageLineLength: Math.round(avgLineLength),
    paragraphCount: paragraphs.length,
    hasFormFields,
  };
}

/**
 * Detect if text contains table-like structures
 */
function detectTables(text: string): boolean {
  // Look for consistent column patterns
  const lines = text.split('\n');
  let consecutiveTabLines = 0;
  let consecutivePipeLines = 0;

  for (const line of lines) {
    if (line.includes('\t') && line.split('\t').length >= 3) {
      consecutiveTabLines++;
    } else {
      consecutiveTabLines = 0;
    }

    if (line.includes('|') && line.split('|').length >= 3) {
      consecutivePipeLines++;
    } else {
      consecutivePipeLines = 0;
    }

    if (consecutiveTabLines >= 2 || consecutivePipeLines >= 2) {
      return true;
    }
  }

  // Also check for aligned columns (consistent spacing patterns)
  const spacePattern = /\s{3,}/g;
  let alignedLines = 0;
  for (const line of lines.slice(0, 50)) {
    const matches = line.match(spacePattern);
    if (matches && matches.length >= 2) {
      alignedLines++;
    }
  }

  return alignedLines >= 5;
}

/**
 * Extract named entities from text
 *
 * @param text - Document text content
 * @returns Extracted entities
 */
export function extractEntities(text: string): ExtractedEntities {
  // Date patterns
  const datePatterns = [
    /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g,
    /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi,
    /\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}/gi,
  ];
  const dates: string[] = [];
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      dates.push(...matches.slice(0, 20));
    }
  }

  // Monetary amounts
  const amountPattern = /[\$\u00a3\u20ac]\s*[\d,]+\.?\d*|\d+\.?\d*\s*(?:USD|EUR|GBP|CAD|AUD)/gi;
  const amounts = (text.match(amountPattern) || []).slice(0, 20);

  // Email addresses
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = (text.match(emailPattern) || []).slice(0, 10);

  // Phone numbers
  const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = (text.match(phonePattern) || []).slice(0, 10);

  // Basic organization detection (words in all caps or ending in Inc, LLC, etc.)
  const orgPattern = /\b[A-Z][A-Z\s&]+(?:Inc|LLC|Corp|Ltd|Co|Company|Corporation|Limited)\.?\b/g;
  const organizations = (text.match(orgPattern) || []).slice(0, 10);

  // Basic person name detection (title + capitalized words)
  const personPattern = /(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/g;
  const persons = (text.match(personPattern) || []).slice(0, 10);

  // Address patterns (basic)
  const addressPattern = /\d+\s+[A-Za-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)[,.\s]/gi;
  const addresses = (text.match(addressPattern) || []).slice(0, 5);

  return {
    dates: [...new Set(dates)],
    amounts: [...new Set(amounts)],
    emails: [...new Set(emails)],
    phones: [...new Set(phones)],
    organizations: [...new Set(organizations)],
    persons: [...new Set(persons)],
    addresses: [...new Set(addresses)],
  };
}

/**
 * Calculate text statistics
 *
 * @param text - Document text content
 * @returns Text statistics
 */
export function calculateTextStats(text: string): TextStatistics {
  const charCount = text.length;
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const lineCount = lines.length;

  // Calculate uppercase ratio
  const upperChars = (text.match(/[A-Z]/g) || []).length;
  const lowerChars = (text.match(/[a-z]/g) || []).length;
  const totalLetters = upperChars + lowerChars;
  const uppercaseRatio = totalLetters > 0 ? upperChars / totalLetters : 0;

  // Calculate numeric ratio
  const numericChars = (text.match(/\d/g) || []).length;
  const alphanumericChars = totalLetters + numericChars;
  const numericRatio = alphanumericChars > 0 ? numericChars / alphanumericChars : 0;

  return {
    charCount,
    wordCount,
    lineCount,
    avgWordsPerLine: lineCount > 0 ? Math.round((wordCount / lineCount) * 10) / 10 : 0,
    uppercaseRatio: Math.round(uppercaseRatio * 100) / 100,
    numericRatio: Math.round(numericRatio * 100) / 100,
  };
}

/**
 * Extract document features for classification
 *
 * @param text - Document text content
 * @param pageCount - Number of pages
 * @param metadata - Optional PDF metadata
 * @param options - Classification options
 * @returns Extracted document features
 *
 * @example
 * ```typescript
 * const features = extractDocumentFeatures(pdfText, 5);
 * console.log(features.keywords);
 * console.log(features.structure);
 * ```
 */
export function extractDocumentFeatures(
  text: string,
  pageCount: number = 1,
  metadata?: Partial<DocumentMetadata>,
  options?: ClassifyOptions
): DocumentFeatures {
  return {
    keywords: detectKeywords(text, options?.customKeywords),
    structure: analyzeStructure(text, pageCount),
    entities: extractEntities(text),
    metadata: metadata || {},
    textStats: calculateTextStats(text),
  };
}

/**
 * Calculate confidence level from score
 */
function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 70) return 'high';
  if (confidence >= 40) return 'medium';
  return 'low';
}

/**
 * Calculate type scores based on features
 */
function calculateTypeScores(features: DocumentFeatures): Map<DocumentType, number> {
  const scores = new Map<DocumentType, number>();

  // Initialize all scores
  const types: DocumentType[] = [
    'invoice', 'contract', 'report', 'resume', 'academic',
    'form', 'letter', 'legal', 'financial', 'medical', 'other',
  ];
  for (const type of types) {
    scores.set(type, 0);
  }

  // Score based on keywords
  for (const match of features.keywords) {
    const currentScore = scores.get(match.category) || 0;
    scores.set(match.category, currentScore + (match.count * match.weight * 10));
  }

  // Structural bonuses
  const struct = features.structure;

  if (struct.hasSignatureArea) {
    // Signature areas are common in contracts, letters, and forms
    scores.set('contract', (scores.get('contract') || 0) + 15);
    scores.set('letter', (scores.get('letter') || 0) + 10);
    scores.set('form', (scores.get('form') || 0) + 10);
    scores.set('legal', (scores.get('legal') || 0) + 10);
  }

  if (struct.hasFormFields) {
    scores.set('form', (scores.get('form') || 0) + 30);
  }

  if (struct.hasTables) {
    scores.set('invoice', (scores.get('invoice') || 0) + 15);
    scores.set('financial', (scores.get('financial') || 0) + 15);
    scores.set('report', (scores.get('report') || 0) + 10);
  }

  if (struct.hasSections) {
    scores.set('report', (scores.get('report') || 0) + 10);
    scores.set('academic', (scores.get('academic') || 0) + 15);
    scores.set('contract', (scores.get('contract') || 0) + 10);
  }

  if (struct.hasNumberedItems && struct.hasLists) {
    scores.set('contract', (scores.get('contract') || 0) + 10);
    scores.set('legal', (scores.get('legal') || 0) + 10);
  }

  // Entity-based adjustments
  const entities = features.entities;

  if (entities.amounts.length >= 3) {
    scores.set('invoice', (scores.get('invoice') || 0) + 20);
    scores.set('financial', (scores.get('financial') || 0) + 15);
  }

  if (entities.emails.length >= 1 && features.textStats.wordCount < 1000) {
    scores.set('letter', (scores.get('letter') || 0) + 10);
    scores.set('resume', (scores.get('resume') || 0) + 10);
  }

  // Text statistics adjustments
  const stats = features.textStats;

  if (stats.uppercaseRatio > 0.3) {
    // High uppercase ratio suggests forms or headers
    scores.set('form', (scores.get('form') || 0) + 10);
  }

  if (stats.numericRatio > 0.1) {
    // High numeric content suggests invoices or financial docs
    scores.set('invoice', (scores.get('invoice') || 0) + 10);
    scores.set('financial', (scores.get('financial') || 0) + 10);
  }

  // Page count adjustments
  if (struct.pageCount === 1) {
    scores.set('letter', (scores.get('letter') || 0) + 5);
    scores.set('invoice', (scores.get('invoice') || 0) + 5);
    scores.set('form', (scores.get('form') || 0) + 5);
  } else if (struct.pageCount >= 10) {
    scores.set('report', (scores.get('report') || 0) + 10);
    scores.set('academic', (scores.get('academic') || 0) + 10);
    scores.set('contract', (scores.get('contract') || 0) + 5);
  }

  // Metadata-based adjustments
  const meta = features.metadata;
  if (meta.title) {
    const lowerTitle = meta.title.toLowerCase();
    for (const type of types) {
      if (type !== 'other' && lowerTitle.includes(type)) {
        scores.set(type, (scores.get(type) || 0) + 25);
      }
    }
  }

  return scores;
}

/**
 * Normalize scores to confidence percentages
 */
function normalizeScores(scores: Map<DocumentType, number>): Map<DocumentType, number> {
  const maxScore = Math.max(...scores.values());

  if (maxScore === 0) {
    return scores;
  }

  const normalized = new Map<DocumentType, number>();
  for (const [type, score] of scores) {
    // Normalize to 0-100 range with diminishing returns
    const normalizedScore = Math.min(100, Math.round((score / maxScore) * 100));
    normalized.set(type, normalizedScore);
  }

  return normalized;
}

/**
 * Classify a document based on its text content
 *
 * Analyzes keywords, structure, entities, and metadata to determine
 * the document type with confidence scores.
 *
 * @param text - Document text content
 * @param pageCount - Number of pages in the document
 * @param metadata - Optional PDF metadata
 * @param options - Classification options
 * @returns Classification result with type, confidence, and features
 *
 * @example
 * ```typescript
 * const result = await classifyDocument(pdfText, 3, pdfMetadata, {
 *   fullAnalysis: true,
 *   onProgress: (info) => console.log(info.percentage),
 * });
 *
 * console.log(result.type);        // 'invoice'
 * console.log(result.confidence);  // 85
 * console.log(result.features);    // { keywords: [...], structure: {...} }
 * ```
 */
export async function classifyDocument(
  text: string,
  pageCount: number = 1,
  metadata?: Partial<DocumentMetadata>,
  options: ClassifyOptions = {}
): Promise<Classification> {
  const {
    onProgress,
    alternativeThreshold = 20,
    maxAlternatives = 3,
  } = options;

  const stages = ['Extracting features', 'Analyzing content', 'Calculating scores'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    reportProgress(0, 0);

    // Extract all features
    const features = extractDocumentFeatures(text, pageCount, metadata, options);

    reportProgress(0, 100);
    reportProgress(1, 0);

    // Calculate type scores
    const rawScores = calculateTypeScores(features);

    reportProgress(1, 100);
    reportProgress(2, 0);

    // Normalize scores
    const normalizedScores = normalizeScores(rawScores);

    // Find the highest scoring type
    let bestType: DocumentType = 'other';
    let bestScore = 0;

    for (const [type, score] of normalizedScores) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    // If best score is too low, classify as 'other'
    if (bestScore < 15) {
      bestType = 'other';
      bestScore = 100 - bestScore; // Invert for 'other' confidence
    }

    // Get alternatives
    const alternatives: Array<{ type: DocumentType; confidence: number }> = [];
    const sortedTypes = [...normalizedScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(([type]) => type !== bestType && type !== 'other');

    for (const [type, score] of sortedTypes.slice(0, maxAlternatives)) {
      if (score >= alternativeThreshold) {
        alternatives.push({ type, confidence: score });
      }
    }

    reportProgress(2, 100);

    return {
      type: bestType,
      confidence: bestScore,
      confidenceLevel: getConfidenceLevel(bestScore),
      alternatives,
      features,
      processingTime: 0,
    };
  });

  return { ...result, processingTime: duration };
}

/**
 * Batch classify multiple documents
 *
 * @param documents - Array of documents with text and metadata
 * @param options - Classification options
 * @returns Array of classification results
 *
 * @example
 * ```typescript
 * const results = await batchClassifyDocuments([
 *   { text: pdfText1, pageCount: 5, name: 'doc1.pdf' },
 *   { text: pdfText2, pageCount: 2, name: 'doc2.pdf' },
 * ]);
 * ```
 */
export async function batchClassifyDocuments(
  documents: Array<{
    text: string;
    pageCount?: number;
    metadata?: Partial<DocumentMetadata>;
    name?: string;
  }>,
  options: ClassifyOptions = {}
): Promise<Array<Classification & { name?: string }>> {
  const { onProgress } = options;
  const results: Array<Classification & { name?: string }> = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]!;

    onProgress?.({
      percentage: Math.round((i / documents.length) * 100),
      stage: `Classifying document ${i + 1} of ${documents.length}`,
      currentItem: i + 1,
      totalItems: documents.length,
    });

    const classification = await classifyDocument(
      doc.text,
      doc.pageCount,
      doc.metadata,
      { ...options, onProgress: undefined }
    );

    results.push({
      ...classification,
      name: doc.name,
    });
  }

  onProgress?.({
    percentage: 100,
    stage: 'Complete',
  });

  return results;
}

/**
 * Get human-readable label for a document type
 */
export function getDocumentTypeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    invoice: 'Invoice',
    contract: 'Contract',
    report: 'Report',
    resume: 'Resume / CV',
    academic: 'Academic Paper',
    form: 'Form',
    letter: 'Letter',
    legal: 'Legal Document',
    financial: 'Financial Document',
    medical: 'Medical Document',
    other: 'Other',
  };
  return labels[type] || 'Unknown';
}

/**
 * Get description for a document type
 */
export function getDocumentTypeDescription(type: DocumentType): string {
  const descriptions: Record<DocumentType, string> = {
    invoice: 'A billing document requesting payment for goods or services',
    contract: 'A legal agreement between parties',
    report: 'A formal document presenting information or findings',
    resume: 'A document summarizing work experience and qualifications',
    academic: 'A scholarly paper or research document',
    form: 'A document with fields to be filled in',
    letter: 'A written message or correspondence',
    legal: 'A formal legal document or filing',
    financial: 'A document related to financial matters',
    medical: 'A healthcare-related document',
    other: 'Document type could not be determined',
  };
  return descriptions[type] || 'Unknown document type';
}

/**
 * Get all available document types
 */
export function getDocumentTypes(): DocumentType[] {
  return [
    'invoice', 'contract', 'report', 'resume', 'academic',
    'form', 'letter', 'legal', 'financial', 'medical', 'other',
  ];
}
