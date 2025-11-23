/**
 * Document Classifier
 * Local classification using patterns, rules, and optional ML
 * All processing runs entirely in the browser
 */

import {
  classifyDocument,
  detectKeywords,
  getDocumentTypes,
  type Classification,
  type ClassifyOptions,
  type DocumentType,
  type DocumentMetadata,
} from '@pdflover/pdf-core';

/**
 * ML Classification state
 */
interface MLModelState {
  model: unknown | null;
  isLoading: boolean;
  error: string | null;
  progress: number;
}

/**
 * ML Classification result
 */
export interface MLClassificationResult {
  type: DocumentType;
  confidence: number;
  rawScores: Record<string, number>;
}

/**
 * Progress callback for ML model loading
 */
export type ModelLoadProgressCallback = (progress: {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}) => void;

/**
 * Global ML model state (singleton)
 */
let mlModelState: MLModelState = {
  model: null,
  isLoading: false,
  error: null,
  progress: 0,
};

/**
 * Check if ML classification is available
 */
export function isMLClassificationAvailable(): boolean {
  return mlModelState.model !== null;
}

/**
 * Get ML model state
 */
export function getMLModelState(): MLModelState {
  return { ...mlModelState };
}

/**
 * Initialize ML model for classification
 * Uses zero-shot classification from Transformers.js
 *
 * @param onProgress - Progress callback for model loading
 * @returns Success status
 *
 * @example
 * ```typescript
 * await initializeMLClassifier((progress) => {
 *   console.log(`Loading: ${progress.progress}%`);
 * });
 * ```
 */
export async function initializeMLClassifier(
  onProgress?: ModelLoadProgressCallback
): Promise<{ success: boolean; error?: string }> {
  if (mlModelState.model) {
    return { success: true };
  }

  if (mlModelState.isLoading) {
    return { success: false, error: 'Model is already loading' };
  }

  mlModelState = {
    ...mlModelState,
    isLoading: true,
    error: null,
    progress: 0,
  };

  try {
    onProgress?.({ status: 'loading', progress: 0 });

    // Dynamic import for code splitting
    const { pipeline, env } = await import('@xenova/transformers');

    // Configure Transformers.js
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    onProgress?.({ status: 'loading', progress: 20 });

    // Load zero-shot classification pipeline
    // Using a smaller model for browser compatibility
    const classifier = await pipeline(
      'zero-shot-classification',
      'Xenova/mobilebert-uncased-mnli',
      {
        progress_callback: (progressData: { status: string; progress?: number }) => {
          mlModelState.progress = progressData.progress ?? 0;
          onProgress?.(progressData);
        },
      }
    );

    mlModelState = {
      model: classifier,
      isLoading: false,
      error: null,
      progress: 100,
    };

    onProgress?.({ status: 'ready', progress: 100 });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load ML model';
    mlModelState = {
      model: null,
      isLoading: false,
      error: errorMessage,
      progress: 0,
    };
    onProgress?.({ status: 'error' });
    return { success: false, error: errorMessage };
  }
}

/**
 * Unload ML model to free memory
 */
export function unloadMLClassifier(): void {
  mlModelState = {
    model: null,
    isLoading: false,
    error: null,
    progress: 0,
  };
}

/**
 * Document type labels for ML classification
 */
const ML_CLASSIFICATION_LABELS: Record<DocumentType, string> = {
  invoice: 'invoice, bill, payment request, billing document',
  contract: 'contract, agreement, legal binding document',
  report: 'report, analysis, summary, findings document',
  resume: 'resume, curriculum vitae, CV, job application',
  academic: 'academic paper, research article, scientific study',
  form: 'form, application form, questionnaire',
  letter: 'letter, correspondence, written message',
  legal: 'legal document, court filing, legal notice',
  financial: 'financial statement, accounting document, fiscal report',
  medical: 'medical record, patient document, healthcare form',
  other: 'general document',
};

/**
 * Classify document using ML (zero-shot classification)
 *
 * @param text - Document text (truncated for model limits)
 * @returns ML classification result
 *
 * @example
 * ```typescript
 * await initializeMLClassifier();
 * const result = await classifyWithML(documentText);
 * console.log(result.type, result.confidence);
 * ```
 */
export async function classifyWithML(text: string): Promise<MLClassificationResult | null> {
  if (!mlModelState.model) {
    return null;
  }

  try {
    const classifier = mlModelState.model as (
      text: string,
      labels: string[],
      options?: { multi_label?: boolean }
    ) => Promise<{ labels: string[]; scores: number[] }>;

    // Truncate text for model limits (typically 512 tokens)
    const truncatedText = text.slice(0, 2000);

    // Get labels for classification
    const types = getDocumentTypes().filter(t => t !== 'other');
    const labels = types.map(t => ML_CLASSIFICATION_LABELS[t]);

    // Run classification
    const result = await classifier(truncatedText, labels, { multi_label: false });

    // Map back to document types
    const rawScores: Record<string, number> = {};
    let bestType: DocumentType = 'other';
    let bestScore = 0;

    for (let i = 0; i < result.labels.length; i++) {
      const label = result.labels[i];
      const score = result.scores[i] ?? 0;

      // Find which type this label belongs to
      for (const [type, typeLabel] of Object.entries(ML_CLASSIFICATION_LABELS)) {
        if (typeLabel === label) {
          rawScores[type] = Math.round(score * 100);
          if (score > bestScore) {
            bestScore = score;
            bestType = type as DocumentType;
          }
          break;
        }
      }
    }

    return {
      type: bestType,
      confidence: Math.round(bestScore * 100),
      rawScores,
    };
  } catch (error) {
    console.error('ML classification error:', error);
    return null;
  }
}

/**
 * Enhanced pattern rules for classification
 */
interface PatternRule {
  type: DocumentType;
  patterns: RegExp[];
  weight: number;
}

/**
 * Additional pattern rules for rule-based classification
 */
const PATTERN_RULES: PatternRule[] = [
  // Invoice patterns
  {
    type: 'invoice',
    patterns: [
      /invoice\s*(?:#|number|no\.?)\s*[\w-]+/i,
      /amount\s*due[:\s]+[\$\d]/i,
      /payment\s+terms/i,
      /bill\s+to[:\s]/i,
      /remit(?:tance)?\s+(?:to|address)/i,
    ],
    weight: 25,
  },
  // Contract patterns
  {
    type: 'contract',
    patterns: [
      /this\s+agreement\s+(?:is\s+)?(?:made|entered)/i,
      /parties?\s+(?:hereby|agree)/i,
      /in\s+witness\s+whereof/i,
      /terms\s+and\s+conditions/i,
      /effective\s+date[:\s]/i,
    ],
    weight: 25,
  },
  // Resume patterns
  {
    type: 'resume',
    patterns: [
      /(?:work|professional)\s+experience/i,
      /education[:\s]+(?:bachelor|master|ph\.?d|degree)/i,
      /skills[:\s]+/i,
      /(?:career\s+)?objective[:\s]/i,
      /references\s+(?:available\s+)?(?:upon|on)\s+request/i,
    ],
    weight: 25,
  },
  // Academic patterns
  {
    type: 'academic',
    patterns: [
      /abstract[:\s]+/i,
      /(?:literature|related\s+work)\s+review/i,
      /methodology[:\s]+/i,
      /\[\d+\]\s+[A-Z]/,  // Citation pattern
      /et\s+al\.?\s*[\[(,]/i,
    ],
    weight: 25,
  },
  // Form patterns
  {
    type: 'form',
    patterns: [
      /please\s+(?:fill|complete|print)/i,
      /\[\s*\]\s+/,  // Checkbox pattern
      /____+/,  // Underline for filling
      /(?:name|date|signature)[:\s]*_{2,}/i,
      /required\s+field/i,
    ],
    weight: 20,
  },
  // Letter patterns
  {
    type: 'letter',
    patterns: [
      /^dear\s+(?:mr|mrs|ms|dr|sir|madam)/im,
      /(?:sincerely|regards|respectfully)[,\s]*$/im,
      /to\s+whom\s+it\s+may\s+concern/i,
      /enclosed\s+(?:please\s+find|you\s+will)/i,
    ],
    weight: 20,
  },
  // Legal patterns
  {
    type: 'legal',
    patterns: [
      /(?:plaintiff|defendant)\s+v\.?\s/i,
      /case\s+(?:#|no\.?|number)\s*[\w-]+/i,
      /motion\s+(?:to|for)\s+/i,
      /(?:hereby\s+)?order(?:ed)?\s+that/i,
      /(?:court|tribunal)\s+of\s+/i,
    ],
    weight: 25,
  },
  // Financial patterns
  {
    type: 'financial',
    patterns: [
      /(?:balance|income)\s+statement/i,
      /(?:total\s+)?(?:assets|liabilities|equity)/i,
      /(?:net\s+)?(?:income|profit|loss)/i,
      /fiscal\s+(?:year|quarter)/i,
      /(?:gaap|ifrs)\s+(?:compliant|standards)/i,
    ],
    weight: 25,
  },
  // Medical patterns
  {
    type: 'medical',
    patterns: [
      /patient\s+(?:name|id|dob)/i,
      /diagnosis[:\s]+/i,
      /(?:medical|medication)\s+history/i,
      /(?:dosage|dose)[:\s]+\d+\s*(?:mg|ml)/i,
      /(?:bp|blood\s+pressure)[:\s]+\d+\/\d+/i,
    ],
    weight: 25,
  },
];

/**
 * Classify document using pattern rules
 *
 * @param text - Document text
 * @returns Scores for each document type
 *
 * @example
 * ```typescript
 * const scores = classifyWithPatterns(documentText);
 * console.log(scores); // { invoice: 45, contract: 10, ... }
 * ```
 */
export function classifyWithPatterns(text: string): Record<DocumentType, number> {
  const scores: Record<DocumentType, number> = {
    invoice: 0,
    contract: 0,
    report: 0,
    resume: 0,
    academic: 0,
    form: 0,
    letter: 0,
    legal: 0,
    financial: 0,
    medical: 0,
    other: 0,
  };

  // Apply pattern rules
  for (const rule of PATTERN_RULES) {
    let matchCount = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        matchCount++;
      }
    }
    // Add weighted score based on pattern matches
    if (matchCount > 0) {
      scores[rule.type] += rule.weight * Math.min(matchCount, 3);
    }
  }

  return scores;
}

/**
 * Combined classification options
 */
export interface CombinedClassifyOptions extends ClassifyOptions {
  /** Whether to use ML classification if available */
  useML?: boolean;
  /** Weight for ML vs pattern classification (0-1, where 1 is ML only) */
  mlWeight?: number;
}

/**
 * Enhanced classification result
 */
export interface EnhancedClassification extends Classification {
  /** Pattern-based scores */
  patternScores: Record<DocumentType, number>;
  /** ML-based result if available */
  mlResult?: MLClassificationResult | null;
  /** Whether ML was used */
  usedML: boolean;
}

/**
 * Classify document using combined pattern and ML approach
 *
 * Uses rule-based classification with optional ML enhancement.
 * Falls back to pattern-only if ML is not available.
 *
 * @param text - Document text content
 * @param pageCount - Number of pages
 * @param metadata - Optional PDF metadata
 * @param options - Classification options
 * @returns Enhanced classification result
 *
 * @example
 * ```typescript
 * const result = await classifyDocumentEnhanced(pdfText, 5, pdfMetadata, {
 *   useML: true,
 *   mlWeight: 0.3,
 *   onProgress: (info) => console.log(info.percentage),
 * });
 *
 * console.log(result.type);
 * console.log(result.confidence);
 * console.log(result.patternScores);
 * ```
 */
export async function classifyDocumentEnhanced(
  text: string,
  pageCount: number = 1,
  metadata?: Partial<DocumentMetadata>,
  options: CombinedClassifyOptions = {}
): Promise<EnhancedClassification> {
  const {
    useML = true,
    mlWeight = 0.3,
    onProgress,
    ...classifyOptions
  } = options;

  onProgress?.({
    percentage: 0,
    stage: 'Starting classification...',
  });

  // Get base classification from pdf-core
  const baseClassification = await classifyDocument(
    text,
    pageCount,
    metadata,
    { ...classifyOptions, onProgress: undefined }
  );

  onProgress?.({
    percentage: 40,
    stage: 'Analyzing patterns...',
  });

  // Get pattern scores
  const patternScores = classifyWithPatterns(text);

  // Combine pattern scores with keyword scores
  const combinedScores = { ...patternScores };
  for (const keyword of baseClassification.features.keywords) {
    combinedScores[keyword.category] =
      (combinedScores[keyword.category] || 0) + (keyword.count * keyword.weight * 5);
  }

  onProgress?.({
    percentage: 60,
    stage: 'Pattern analysis complete',
  });

  // Try ML classification if requested and available
  let mlResult: MLClassificationResult | null = null;
  let usedML = false;

  if (useML && isMLClassificationAvailable()) {
    onProgress?.({
      percentage: 70,
      stage: 'Running ML classification...',
    });

    mlResult = await classifyWithML(text);
    usedML = mlResult !== null;
  }

  onProgress?.({
    percentage: 90,
    stage: 'Calculating final scores...',
  });

  // Calculate final type and confidence
  let finalType = baseClassification.type;
  let finalConfidence = baseClassification.confidence;

  if (usedML && mlResult) {
    // Combine ML and pattern results
    const patternConfidence = baseClassification.confidence;
    const mlConfidence = mlResult.confidence;

    // Weighted combination
    finalConfidence = Math.round(
      patternConfidence * (1 - mlWeight) + mlConfidence * mlWeight
    );

    // If ML strongly disagrees and has high confidence, consider it
    if (mlResult.confidence > 70 && mlResult.type !== baseClassification.type) {
      // Check if ML type also has decent pattern support
      const mlTypePatternScore = combinedScores[mlResult.type] || 0;
      const baseTypePatternScore = combinedScores[baseClassification.type] || 0;

      if (mlTypePatternScore > baseTypePatternScore * 0.5) {
        finalType = mlResult.type;
      }
    }
  }

  onProgress?.({
    percentage: 100,
    stage: 'Classification complete',
  });

  return {
    ...baseClassification,
    type: finalType,
    confidence: finalConfidence,
    patternScores: combinedScores,
    mlResult,
    usedML,
  };
}

/**
 * Quick classification using patterns only (fast)
 *
 * @param text - Document text
 * @returns Quick classification result
 */
export function quickClassify(text: string): { type: DocumentType; confidence: number } {
  const patternScores = classifyWithPatterns(text);
  const keywords = detectKeywords(text);

  // Combine with keyword scores
  for (const keyword of keywords) {
    patternScores[keyword.category] =
      (patternScores[keyword.category] || 0) + (keyword.count * keyword.weight * 3);
  }

  // Find best type
  let bestType: DocumentType = 'other';
  let bestScore = 0;

  for (const [type, score] of Object.entries(patternScores)) {
    if (score > bestScore && type !== 'other') {
      bestScore = score;
      bestType = type as DocumentType;
    }
  }

  // Calculate confidence (normalize to 0-100)
  const maxPossibleScore = 200;
  const confidence = Math.min(100, Math.round((bestScore / maxPossibleScore) * 100));

  if (confidence < 15) {
    return { type: 'other', confidence: 100 - confidence };
  }

  return { type: bestType, confidence };
}

/**
 * Batch classify multiple documents
 *
 * @param documents - Array of documents to classify
 * @param options - Classification options
 * @returns Array of classification results
 */
export async function batchClassifyEnhanced(
  documents: Array<{
    text: string;
    pageCount?: number;
    metadata?: Partial<DocumentMetadata>;
    name?: string;
  }>,
  options: CombinedClassifyOptions = {}
): Promise<Array<EnhancedClassification & { name?: string }>> {
  const { onProgress } = options;
  const results: Array<EnhancedClassification & { name?: string }> = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]!;

    onProgress?.({
      percentage: Math.round((i / documents.length) * 100),
      stage: `Classifying ${doc.name || `document ${i + 1}`}`,
      currentItem: i + 1,
      totalItems: documents.length,
    });

    const classification = await classifyDocumentEnhanced(
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
    stage: 'Batch classification complete',
  });

  return results;
}

/**
 * Generate classification summary statistics
 */
export interface ClassificationSummary {
  totalDocuments: number;
  byType: Record<DocumentType, number>;
  averageConfidence: number;
  highConfidenceCount: number;
  lowConfidenceCount: number;
}

/**
 * Generate summary statistics from batch classification results
 *
 * @param results - Array of classification results
 * @returns Summary statistics
 */
export function generateClassificationSummary(
  results: Array<EnhancedClassification | Classification>
): ClassificationSummary {
  const byType: Record<DocumentType, number> = {
    invoice: 0,
    contract: 0,
    report: 0,
    resume: 0,
    academic: 0,
    form: 0,
    letter: 0,
    legal: 0,
    financial: 0,
    medical: 0,
    other: 0,
  };

  let totalConfidence = 0;
  let highConfidenceCount = 0;
  let lowConfidenceCount = 0;

  for (const result of results) {
    byType[result.type]++;
    totalConfidence += result.confidence;

    if (result.confidenceLevel === 'high') {
      highConfidenceCount++;
    } else if (result.confidenceLevel === 'low') {
      lowConfidenceCount++;
    }
  }

  return {
    totalDocuments: results.length,
    byType,
    averageConfidence: results.length > 0 ? Math.round(totalConfidence / results.length) : 0,
    highConfidenceCount,
    lowConfidenceCount,
  };
}

// Re-export types and utilities from pdf-core
export type {
  Classification,
  DocumentType,
  DocumentFeatures,
  KeywordMatch,
  DocumentMetadata,
  ConfidenceLevel,
} from '@pdflover/pdf-core';

export {
  getDocumentTypes,
  getDocumentTypeLabel,
  getDocumentTypeDescription,
  detectKeywords,
  extractDocumentFeatures,
} from '@pdflover/pdf-core';
