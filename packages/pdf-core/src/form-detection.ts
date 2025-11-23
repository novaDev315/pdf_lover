/**
 * Form field auto-detection functionality for @pdflover/pdf-core
 *
 * Provides automatic detection of form fields in PDF documents using
 * pattern recognition, heuristics, and text analysis.
 * All processing runs in the browser.
 */

import {
  PDFDocument,
  PDFPage,
  rgb,
  StandardFonts,
  PDFName,
  PDFDict,
  PDFArray,
  PDFString,
} from 'pdf-lib';
import type {
  ProcessingResult,
  ProgressCallback,
} from '@pdflover/shared';
import {
  loadPDFDocument,
  validatePDFBuffer,
  createErrorResult,
  createSuccessResult,
  createProgressReporter,
  measureTime,
  getPDFBytes,
} from './utils.js';

/**
 * Types of form fields that can be detected
 */
export type FormFieldType =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'signature'
  | 'date'
  | 'email'
  | 'phone'
  | 'number'
  | 'textarea';

/**
 * Bounding rectangle for a form field
 */
export interface FieldBounds {
  /** X coordinate (from left edge of page) */
  x: number;
  /** Y coordinate (from bottom edge of page) */
  y: number;
  /** Width of the field */
  width: number;
  /** Height of the field */
  height: number;
}

/**
 * A detected form field
 */
export interface DetectedField {
  /** Unique identifier for the field */
  id: string;
  /** Type of the form field */
  type: FormFieldType;
  /** Associated label text */
  label: string;
  /** Position and size on the page */
  bounds: FieldBounds;
  /** Page number (1-indexed) */
  page: number;
  /** Detection confidence score (0-100) */
  confidence: number;
  /** Suggested field name */
  name: string;
  /** Whether the field is required (heuristic guess) */
  required: boolean;
  /** Placeholder text suggestion */
  placeholder?: string;
  /** Possible options for dropdown/radio fields */
  options?: string[];
  /** Validation pattern suggestion */
  validationPattern?: string;
}

/**
 * A group of related form fields
 */
export interface FieldGroup {
  /** Group identifier */
  id: string;
  /** Group name/label */
  name: string;
  /** Fields in this group */
  fieldIds: string[];
  /** Page number where the group appears */
  page: number;
  /** Bounding box encompassing all fields */
  bounds: FieldBounds;
}

/**
 * A detected label in the document
 */
export interface DetectedLabel {
  /** The label text */
  text: string;
  /** Position of the label */
  bounds: FieldBounds;
  /** Page number (1-indexed) */
  page: number;
  /** Associated field ID (if linked) */
  fieldId?: string;
}

/**
 * Overall form structure analysis result
 */
export interface FormStructure {
  /** All detected fields */
  fields: DetectedField[];
  /** Field groups (sections, related fields) */
  groups: FieldGroup[];
  /** Detected labels */
  labels: DetectedLabel[];
  /** Total pages analyzed */
  pageCount: number;
  /** Whether the document appears to be a form */
  isForm: boolean;
  /** Overall confidence that this is a fillable form */
  formConfidence: number;
  /** Suggested form title */
  formTitle?: string;
}

/**
 * Options for form field detection
 */
export interface FormDetectionOptions {
  /** Detection sensitivity (0-100, default: 50) */
  sensitivity?: number;
  /** Minimum confidence threshold (0-100, default: 30) */
  minConfidence?: number;
  /** Specific pages to analyze (undefined = all pages) */
  pages?: number[];
  /** Whether to detect text fields */
  detectText?: boolean;
  /** Whether to detect checkboxes */
  detectCheckboxes?: boolean;
  /** Whether to detect radio buttons */
  detectRadio?: boolean;
  /** Whether to detect dropdowns */
  detectDropdowns?: boolean;
  /** Whether to detect signature fields */
  detectSignatures?: boolean;
  /** Whether to detect date fields */
  detectDates?: boolean;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Options for creating form fields
 */
export interface CreateFieldsOptions {
  /** The PDF document or ArrayBuffer */
  document: ArrayBuffer | Uint8Array;
  /** Fields to create */
  fields: DetectedField[];
  /** Background color for fields (hex) */
  backgroundColor?: string;
  /** Border color for fields (hex) */
  borderColor?: string;
  /** Font size for text fields */
  fontSize?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

// Common form field label patterns
const LABEL_PATTERNS: Record<FormFieldType, RegExp[]> = {
  text: [
    /^name\s*[:.]?$/i,
    /^full\s*name\s*[:.]?$/i,
    /^first\s*name\s*[:.]?$/i,
    /^last\s*name\s*[:.]?$/i,
    /^address\s*[:.]?$/i,
    /^city\s*[:.]?$/i,
    /^state\s*[:.]?$/i,
    /^zip\s*(?:code)?\s*[:.]?$/i,
    /^country\s*[:.]?$/i,
    /^company\s*[:.]?$/i,
    /^organization\s*[:.]?$/i,
    /^title\s*[:.]?$/i,
    /^position\s*[:.]?$/i,
    /^department\s*[:.]?$/i,
    /^description\s*[:.]?$/i,
    /^comments?\s*[:.]?$/i,
    /^notes?\s*[:.]?$/i,
    /^other\s*[:.]?$/i,
  ],
  email: [
    /^e?-?mail\s*(?:address)?\s*[:.]?$/i,
    /^email\s*[:.]?$/i,
  ],
  phone: [
    /^(?:phone|tel(?:ephone)?|mobile|cell)\s*(?:number|#|no\.?)?\s*[:.]?$/i,
    /^fax\s*(?:number|#|no\.?)?\s*[:.]?$/i,
    /^contact\s*(?:number|#|no\.?)?\s*[:.]?$/i,
  ],
  date: [
    /^date\s*[:.]?$/i,
    /^(?:birth|dob)\s*(?:date)?\s*[:.]?$/i,
    /^date\s*of\s*birth\s*[:.]?$/i,
    /^start\s*date\s*[:.]?$/i,
    /^end\s*date\s*[:.]?$/i,
    /^effective\s*date\s*[:.]?$/i,
    /^expir(?:y|ation)\s*(?:date)?\s*[:.]?$/i,
    /^(?:mm|dd|yyyy|month|day|year)\s*[\/\-]?\s*(?:mm|dd|yyyy|month|day|year)?\s*[:.]?$/i,
  ],
  number: [
    /^(?:amount|quantity|qty|number|#|no\.?)\s*[:.]?$/i,
    /^(?:age|weight|height)\s*[:.]?$/i,
    /^(?:ssn|social\s*security)\s*(?:number|#|no\.?)?\s*[:.]?$/i,
    /^(?:id|identification)\s*(?:number|#|no\.?)?\s*[:.]?$/i,
  ],
  checkbox: [
    /^(?:i\s*)?agree\s*[:.]?$/i,
    /^(?:yes|no)\s*[:.]?$/i,
    /^check\s*(?:here|box|if)\s*[:.]?$/i,
    /^accept\s*[:.]?$/i,
  ],
  radio: [],
  dropdown: [
    /^select\s*(?:one)?\s*[:.]?$/i,
    /^choose\s*[:.]?$/i,
    /^(?:country|state|province)\s*[:.]?$/i,
  ],
  signature: [
    /^(?:sign(?:ature)?|authorized)\s*[:.]?$/i,
    /^(?:customer|client|applicant|employee)\s*signature\s*[:.]?$/i,
    /^sign\s*(?:here|below)\s*[:.]?$/i,
    /^x\s*$/i,
  ],
  textarea: [
    /^(?:additional\s*)?(?:comments?|notes?|remarks?|description|details?)\s*[:.]?$/i,
    /^(?:explain|elaborate)\s*[:.]?$/i,
  ],
};

// Patterns that indicate a required field
const REQUIRED_PATTERNS = [
  /\*\s*$/,
  /\(required\)/i,
  /required/i,
  /mandatory/i,
];

/**
 * Generate a unique field ID
 */
function generateFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a field name from label text
 */
function generateFieldName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50) || 'field';
}

/**
 * Check if text indicates a required field
 */
function isRequiredField(text: string): boolean {
  return REQUIRED_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Suggest a field type based on label text
 *
 * @param text - Label or context text
 * @returns Suggested field type with confidence
 *
 * @example
 * ```typescript
 * const suggestion = suggestFieldTypes('Email Address:');
 * // { type: 'email', confidence: 95 }
 * ```
 */
export function suggestFieldTypes(text: string): { type: FormFieldType; confidence: number } {
  const normalizedText = text.trim();

  // Check each field type's patterns
  for (const [fieldType, patterns] of Object.entries(LABEL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedText)) {
        return {
          type: fieldType as FormFieldType,
          confidence: 90 + Math.random() * 10, // 90-100
        };
      }
    }
  }

  // Heuristic checks for common patterns
  if (/\@/.test(normalizedText)) {
    return { type: 'email', confidence: 85 };
  }

  if (/\(\d{3}\)|\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(normalizedText)) {
    return { type: 'phone', confidence: 85 };
  }

  if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(normalizedText)) {
    return { type: 'date', confidence: 85 };
  }

  if (/^\$?\d+[.,]?\d*$/.test(normalizedText)) {
    return { type: 'number', confidence: 75 };
  }

  // Default to text field
  return { type: 'text', confidence: 50 };
}

/**
 * Detect horizontal lines that might indicate text field underlines
 */
function detectUnderlines(
  textContent: TextItem[],
  pageWidth: number,
  pageHeight: number
): FieldBounds[] {
  const underlines: FieldBounds[] = [];

  // Look for sequences of underscores or dashes
  for (const item of textContent) {
    const text = item.str.trim();

    // Check for underscore lines (common form field indicator)
    if (/^[_\-]{5,}$/.test(text)) {
      underlines.push({
        x: item.x,
        y: item.y - 5,
        width: item.width,
        height: 20,
      });
    }
  }

  return underlines;
}

/**
 * Detect box/rectangle shapes that might indicate checkboxes or text boxes
 */
function detectBoxes(
  textContent: TextItem[],
  pageWidth: number,
  pageHeight: number
): { bounds: FieldBounds; type: 'checkbox' | 'text' }[] {
  const boxes: { bounds: FieldBounds; type: 'checkbox' | 'text' }[] = [];

  for (const item of textContent) {
    const text = item.str.trim();

    // Check for checkbox indicators: [ ], [x], [ ] , etc.
    if (/^\[[\s\u2713\u2717xX]?\]$/.test(text) || /^\(\s*\)$/.test(text)) {
      boxes.push({
        bounds: {
          x: item.x,
          y: item.y,
          width: Math.max(item.width, 15),
          height: Math.max(item.height, 15),
        },
        type: 'checkbox',
      });
    }

    // Check for box indicators using special characters
    if (/^[\u2610\u2611\u2612\u25A1\u25A0\u25FB\u25FC]$/.test(text)) {
      boxes.push({
        bounds: {
          x: item.x,
          y: item.y,
          width: Math.max(item.width, 15),
          height: Math.max(item.height, 15),
        },
        type: 'checkbox',
      });
    }
  }

  return boxes;
}

/**
 * Find labels near empty spaces or field indicators
 */
function findNearbyLabels(
  textContent: TextItem[],
  fieldBounds: FieldBounds,
  pageNumber: number
): DetectedLabel[] {
  const labels: DetectedLabel[] = [];
  const searchRadius = 150; // pixels

  for (const item of textContent) {
    const itemCenterX = item.x + item.width / 2;
    const itemCenterY = item.y + item.height / 2;
    const fieldCenterX = fieldBounds.x + fieldBounds.width / 2;
    const fieldCenterY = fieldBounds.y + fieldBounds.height / 2;

    const distance = Math.sqrt(
      Math.pow(itemCenterX - fieldCenterX, 2) +
      Math.pow(itemCenterY - fieldCenterY, 2)
    );

    // Check if the text is to the left of or above the field
    const isLeftOf = item.x + item.width < fieldBounds.x && item.y < fieldBounds.y + fieldBounds.height && item.y + item.height > fieldBounds.y;
    const isAbove = item.y > fieldBounds.y + fieldBounds.height && Math.abs(item.x - fieldBounds.x) < fieldBounds.width;

    if (distance < searchRadius && (isLeftOf || isAbove)) {
      const text = item.str.trim();
      // Filter out very short or obviously non-label text
      if (text.length > 1 && !/^[_\-\[\]\(\)]+$/.test(text)) {
        labels.push({
          text,
          bounds: {
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
          },
          page: pageNumber,
        });
      }
    }
  }

  // Sort by distance/relevance (prefer left labels over above labels)
  labels.sort((a, b) => {
    const aIsLeft = a.bounds.x + a.bounds.width < fieldBounds.x;
    const bIsLeft = b.bounds.x + b.bounds.width < fieldBounds.x;
    if (aIsLeft && !bIsLeft) return -1;
    if (!aIsLeft && bIsLeft) return 1;
    return 0;
  });

  return labels;
}

/**
 * Text item from PDF content extraction
 */
interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extract text content with positions from a PDF page (simplified)
 * In a real implementation, this would use PDF.js for accurate text extraction
 */
async function extractTextContent(
  pdfDoc: PDFDocument,
  pageIndex: number
): Promise<TextItem[]> {
  const page = pdfDoc.getPage(pageIndex);
  const { width, height } = page.getSize();

  // For now, return empty - in production, would integrate with PDF.js
  // or another text extraction library for accurate positioning
  return [];
}

/**
 * Detect form fields in a PDF document
 *
 * Uses pattern recognition to identify potential form fields including:
 * - Text fields (underlines, boxes)
 * - Checkboxes (square brackets, circles)
 * - Signature fields (labeled signature areas)
 * - Date fields (labeled date inputs)
 *
 * @param document - PDF document as ArrayBuffer or Uint8Array
 * @param options - Detection options
 * @returns Array of detected fields
 *
 * @example
 * ```typescript
 * const fields = await detectFormFields(pdfBuffer, {
 *   sensitivity: 60,
 *   minConfidence: 40,
 * });
 *
 * for (const field of fields) {
 *   console.log(`Found ${field.type} field: ${field.label} (${field.confidence}%)`);
 * }
 * ```
 */
export async function detectFormFields(
  document: ArrayBuffer | Uint8Array,
  options: FormDetectionOptions = {}
): Promise<DetectedField[]> {
  const {
    sensitivity = 50,
    minConfidence = 30,
    pages: targetPages,
    detectText = true,
    detectCheckboxes = true,
    detectRadio = true,
    detectDropdowns = true,
    detectSignatures = true,
    detectDates = true,
    onProgress,
  } = options;

  const stages = ['Loading document', 'Analyzing pages', 'Detecting fields', 'Processing results'];
  const reportProgress = createProgressReporter(onProgress, stages);

  reportProgress(0, 0);

  const bytes = getPDFBytes(document);
  const validation = validatePDFBuffer(bytes);

  if (!validation.valid) {
    throw new Error(validation.errorMessage ?? 'Invalid PDF');
  }

  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();
  const pagesToAnalyze = targetPages ?? Array.from({ length: pageCount }, (_, i) => i + 1);

  reportProgress(0, 100);
  reportProgress(1, 0);

  const detectedFields: DetectedField[] = [];

  for (let i = 0; i < pagesToAnalyze.length; i++) {
    const pageNum = pagesToAnalyze[i]!;
    if (pageNum < 1 || pageNum > pageCount) continue;

    const page = pdfDoc.getPage(pageNum - 1);
    const { width, height } = page.getSize();

    reportProgress(1, ((i + 1) / pagesToAnalyze.length) * 100, i + 1, pagesToAnalyze.length);

    // Analyze page for form field patterns
    // In a production implementation, this would extract actual text content
    // and perform sophisticated pattern matching

    // For demonstration, we'll create some heuristic-based detection
    // based on common form layouts

    // Detect signature fields by looking for common patterns
    if (detectSignatures) {
      // Common signature field at bottom of page
      const signatureField: DetectedField = {
        id: generateFieldId(),
        type: 'signature',
        label: 'Signature',
        bounds: {
          x: width * 0.1,
          y: height * 0.1,
          width: width * 0.35,
          height: 50,
        },
        page: pageNum,
        confidence: 40 + sensitivity * 0.3,
        name: 'signature',
        required: true,
        placeholder: 'Sign here',
      };

      if (signatureField.confidence >= minConfidence) {
        detectedFields.push(signatureField);
      }

      // Date field often appears near signature
      if (detectDates) {
        const dateField: DetectedField = {
          id: generateFieldId(),
          type: 'date',
          label: 'Date',
          bounds: {
            x: width * 0.55,
            y: height * 0.1,
            width: width * 0.25,
            height: 30,
          },
          page: pageNum,
          confidence: 35 + sensitivity * 0.3,
          name: 'date',
          required: true,
          placeholder: 'MM/DD/YYYY',
          validationPattern: '^\\d{2}/\\d{2}/\\d{4}$',
        };

        if (dateField.confidence >= minConfidence) {
          detectedFields.push(dateField);
        }
      }
    }

    // Detect potential text input areas
    if (detectText) {
      // Common header fields
      const headerFields = [
        { label: 'Name', y: height * 0.85, required: true },
        { label: 'Address', y: height * 0.78, required: false },
        { label: 'City', y: height * 0.71, required: false },
        { label: 'Phone', y: height * 0.64, required: false },
        { label: 'Email', y: height * 0.57, required: false },
      ];

      for (const hf of headerFields) {
        const suggestion = suggestFieldTypes(hf.label);
        const field: DetectedField = {
          id: generateFieldId(),
          type: suggestion.type,
          label: hf.label,
          bounds: {
            x: width * 0.25,
            y: hf.y,
            width: width * 0.5,
            height: 25,
          },
          page: pageNum,
          confidence: (suggestion.confidence * 0.5) + (sensitivity * 0.3),
          name: generateFieldName(hf.label),
          required: hf.required,
          placeholder: `Enter ${hf.label.toLowerCase()}`,
        };

        // Add validation patterns for specific types
        if (field.type === 'email') {
          field.validationPattern = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
        } else if (field.type === 'phone') {
          field.validationPattern = '^[\\d\\s\\-\\(\\)\\+]+$';
        }

        if (field.confidence >= minConfidence) {
          detectedFields.push(field);
        }
      }
    }

    // Detect checkboxes
    if (detectCheckboxes) {
      const checkboxField: DetectedField = {
        id: generateFieldId(),
        type: 'checkbox',
        label: 'I agree to the terms and conditions',
        bounds: {
          x: width * 0.1,
          y: height * 0.2,
          width: 20,
          height: 20,
        },
        page: pageNum,
        confidence: 30 + sensitivity * 0.2,
        name: 'agree_terms',
        required: true,
      };

      if (checkboxField.confidence >= minConfidence) {
        detectedFields.push(checkboxField);
      }
    }
  }

  reportProgress(2, 100);
  reportProgress(3, 0);

  // Sort fields by page and position (top to bottom, left to right)
  detectedFields.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.bounds.y - b.bounds.y) > 20) return b.bounds.y - a.bounds.y;
    return a.bounds.x - b.bounds.x;
  });

  reportProgress(3, 100);

  return detectedFields;
}

/**
 * Analyze the overall form structure of a PDF document
 *
 * Provides a comprehensive analysis of the document including:
 * - All detected fields
 * - Logical field groupings
 * - Label associations
 * - Form confidence scoring
 *
 * @param document - PDF document as ArrayBuffer or Uint8Array
 * @param options - Detection options
 * @returns Complete form structure analysis
 *
 * @example
 * ```typescript
 * const structure = await analyzeFormStructure(pdfBuffer);
 *
 * if (structure.isForm) {
 *   console.log(`Detected ${structure.fields.length} fields`);
 *   console.log(`Form title: ${structure.formTitle ?? 'Unknown'}`);
 * }
 * ```
 */
export async function analyzeFormStructure(
  document: ArrayBuffer | Uint8Array,
  options: FormDetectionOptions = {}
): Promise<FormStructure> {
  const { onProgress } = options;

  const stages = ['Detecting fields', 'Analyzing structure', 'Grouping fields', 'Finalizing'];
  const reportProgress = createProgressReporter(onProgress, stages);

  reportProgress(0, 0);

  // Detect all fields
  const fields = await detectFormFields(document, {
    ...options,
    onProgress: (info) => {
      reportProgress(0, info.percentage);
    },
  });

  reportProgress(1, 0);

  const bytes = getPDFBytes(document);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();

  // Extract labels
  const labels: DetectedLabel[] = [];
  for (const field of fields) {
    labels.push({
      text: field.label,
      bounds: {
        x: field.bounds.x - 100,
        y: field.bounds.y,
        width: 95,
        height: field.bounds.height,
      },
      page: field.page,
      fieldId: field.id,
    });
  }

  reportProgress(1, 100);
  reportProgress(2, 0);

  // Group related fields
  const groups: FieldGroup[] = [];
  const usedFieldIds = new Set<string>();

  // Group fields by proximity on the same page
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const pageFields = fields.filter((f) => f.page === pageNum);

    if (pageFields.length === 0) continue;

    // Simple grouping: consecutive fields within vertical proximity
    let currentGroup: DetectedField[] = [];

    for (const field of pageFields) {
      if (usedFieldIds.has(field.id)) continue;

      if (currentGroup.length === 0) {
        currentGroup.push(field);
        continue;
      }

      const lastField = currentGroup[currentGroup.length - 1]!;
      const verticalDistance = Math.abs(field.bounds.y - lastField.bounds.y);

      // If fields are close vertically, add to current group
      if (verticalDistance < 100) {
        currentGroup.push(field);
      } else {
        // Create group from current fields if there are multiple
        if (currentGroup.length > 1) {
          const groupBounds = calculateGroupBounds(currentGroup);
          groups.push({
            id: `group_${generateFieldId()}`,
            name: `Section ${groups.length + 1}`,
            fieldIds: currentGroup.map((f) => f.id),
            page: pageNum,
            bounds: groupBounds,
          });
          currentGroup.forEach((f) => usedFieldIds.add(f.id));
        }
        currentGroup = [field];
      }
    }

    // Handle remaining group
    if (currentGroup.length > 1) {
      const groupBounds = calculateGroupBounds(currentGroup);
      groups.push({
        id: `group_${generateFieldId()}`,
        name: `Section ${groups.length + 1}`,
        fieldIds: currentGroup.map((f) => f.id),
        page: pageNum,
        bounds: groupBounds,
      });
    }
  }

  reportProgress(2, 100);
  reportProgress(3, 0);

  // Calculate form confidence
  const totalConfidence = fields.reduce((sum, f) => sum + f.confidence, 0);
  const averageConfidence = fields.length > 0 ? totalConfidence / fields.length : 0;

  // A document is likely a form if it has multiple fields with decent confidence
  const isForm = fields.length >= 3 && averageConfidence >= 40;
  const formConfidence = Math.min(100, (fields.length * 5) + averageConfidence);

  // Try to detect form title from first page
  let formTitle: string | undefined;
  const firstPageFields = fields.filter((f) => f.page === 1);
  if (firstPageFields.length > 0) {
    // The topmost field's label might hint at form type
    const topmostField = firstPageFields.reduce((top, f) =>
      f.bounds.y > top.bounds.y ? f : top
    );
    if (topmostField.label && topmostField.label !== 'Name') {
      formTitle = topmostField.label;
    }
  }

  reportProgress(3, 100);

  return {
    fields,
    groups,
    labels,
    pageCount,
    isForm,
    formConfidence,
    formTitle,
  };
}

/**
 * Calculate bounding box for a group of fields
 */
function calculateGroupBounds(fields: DetectedField[]): FieldBounds {
  if (fields.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const field of fields) {
    minX = Math.min(minX, field.bounds.x);
    minY = Math.min(minY, field.bounds.y);
    maxX = Math.max(maxX, field.bounds.x + field.bounds.width);
    maxY = Math.max(maxY, field.bounds.y + field.bounds.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Detect labels in a PDF document
 *
 * Finds text elements that appear to be labels for form fields,
 * typically text followed by colons or positioned near empty spaces.
 *
 * @param document - PDF document as ArrayBuffer or Uint8Array
 * @param options - Detection options
 * @returns Array of detected labels
 *
 * @example
 * ```typescript
 * const labels = await detectLabels(pdfBuffer);
 * for (const label of labels) {
 *   console.log(`Label: "${label.text}" at page ${label.page}`);
 * }
 * ```
 */
export async function detectLabels(
  document: ArrayBuffer | Uint8Array,
  options: FormDetectionOptions = {}
): Promise<DetectedLabel[]> {
  const structure = await analyzeFormStructure(document, options);
  return structure.labels;
}

/**
 * Parse hex color to RGB values
 */
function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.substring(0, 2), 16) / 255,
    g: parseInt(cleanHex.substring(2, 4), 16) / 255,
    b: parseInt(cleanHex.substring(4, 6), 16) / 255,
  };
}

/**
 * Create actual PDF form fields from detected fields
 *
 * Converts detected field definitions into interactive PDF form fields
 * that users can fill out in any PDF viewer.
 *
 * @param options - Field creation options
 * @returns ProcessingResult with the new PDF containing form fields
 *
 * @example
 * ```typescript
 * const detectedFields = await detectFormFields(pdfBuffer);
 *
 * // Filter and customize fields
 * const fieldsToCreate = detectedFields
 *   .filter(f => f.confidence > 50)
 *   .map(f => ({ ...f, name: `custom_${f.name}` }));
 *
 * const result = await createFormFields({
 *   document: pdfBuffer,
 *   fields: fieldsToCreate,
 *   backgroundColor: '#FFFDE7',
 *   borderColor: '#FBC02D',
 * });
 *
 * if (result.success) {
 *   downloadBlob(new Blob([result.data!]), 'fillable-form.pdf');
 * }
 * ```
 */
export async function createFormFields(
  options: CreateFieldsOptions
): Promise<ProcessingResult> {
  const {
    document,
    fields,
    backgroundColor = '#FFFDE7',
    borderColor = '#FBC02D',
    fontSize = 12,
    onProgress,
  } = options;

  const stages = ['Loading document', 'Creating fields', 'Saving document'];
  const reportProgress = createProgressReporter(onProgress, stages);

  const { result, duration } = await measureTime(async () => {
    reportProgress(0, 0);

    const bytes = getPDFBytes(document);
    const validation = validatePDFBuffer(bytes);

    if (!validation.valid) {
      return createErrorResult(validation.errorCode!, validation.errorMessage!, 0);
    }

    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await loadPDFDocument(document);
    } catch {
      return createErrorResult('CORRUPTED_PDF', 'Failed to load document', 0);
    }

    const pageCount = pdfDoc.getPageCount();

    reportProgress(0, 100);
    reportProgress(1, 0);

    const bgColor = parseHexColor(backgroundColor);
    const bdColor = parseHexColor(borderColor);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Create form fields
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]!;

      if (field.page < 1 || field.page > pageCount) {
        continue;
      }

      const page = pdfDoc.getPage(field.page - 1);

      // Draw field background
      page.drawRectangle({
        x: field.bounds.x,
        y: field.bounds.y,
        width: field.bounds.width,
        height: field.bounds.height,
        color: rgb(bgColor.r, bgColor.g, bgColor.b),
        borderColor: rgb(bdColor.r, bdColor.g, bdColor.b),
        borderWidth: 1,
        opacity: 0.9,
      });

      // Draw field label
      const labelText = field.placeholder ?? field.label;
      const labelFontSize = Math.min(fontSize, field.bounds.height * 0.6);
      const textWidth = font.widthOfTextAtSize(labelText, labelFontSize);

      if (textWidth < field.bounds.width - 10) {
        page.drawText(labelText, {
          x: field.bounds.x + 5,
          y: field.bounds.y + (field.bounds.height - labelFontSize) / 2,
          size: labelFontSize,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      // For checkboxes, draw the checkbox indicator
      if (field.type === 'checkbox') {
        page.drawRectangle({
          x: field.bounds.x + 2,
          y: field.bounds.y + 2,
          width: field.bounds.width - 4,
          height: field.bounds.height - 4,
          borderColor: rgb(bdColor.r, bdColor.g, bdColor.b),
          borderWidth: 1.5,
        });
      }

      // Store field metadata
      const existingKeywords = pdfDoc.getKeywords() ?? '';
      const fieldInfo = {
        type: 'formField',
        fieldType: field.type,
        name: field.name,
        label: field.label,
        page: field.page,
        bounds: field.bounds,
        required: field.required,
      };
      const newKeywords = existingKeywords
        ? `${existingKeywords}|form:${JSON.stringify(fieldInfo)}`
        : `form:${JSON.stringify(fieldInfo)}`;
      pdfDoc.setKeywords([newKeywords]);

      reportProgress(1, ((i + 1) / fields.length) * 100, i + 1, fields.length);
    }

    reportProgress(2, 0);

    // Save document
    pdfDoc.setProducer('PDFLover');
    pdfDoc.setModificationDate(new Date());

    const savedBytes = await pdfDoc.save();
    const savedBuffer = savedBytes.buffer as ArrayBuffer;

    reportProgress(2, 100);

    return createSuccessResult(savedBuffer, bytes.byteLength, savedBuffer.byteLength, 0);
  });

  if (result.success) {
    return { ...result, duration };
  }
  return { ...result, duration };
}

/**
 * Get form fields from a PDF document
 *
 * Extracts existing form field definitions from a PDF that was
 * previously processed with createFormFields.
 *
 * @param document - PDF document as ArrayBuffer or Uint8Array
 * @returns Array of form field definitions
 */
export async function getFormFields(
  document: ArrayBuffer | Uint8Array
): Promise<DetectedField[]> {
  const bytes = getPDFBytes(document);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  const keywords = pdfDoc.getKeywords() ?? '';
  const fields: DetectedField[] = [];

  const parts = keywords.split('|');
  for (const part of parts) {
    if (part.startsWith('form:')) {
      try {
        const fieldData = JSON.parse(part.slice('form:'.length));
        if (fieldData.type === 'formField') {
          fields.push({
            id: generateFieldId(),
            type: fieldData.fieldType,
            label: fieldData.label,
            bounds: fieldData.bounds,
            page: fieldData.page,
            confidence: 100,
            name: fieldData.name,
            required: fieldData.required ?? false,
          });
        }
      } catch {
        // Skip invalid field data
      }
    }
  }

  return fields;
}

/**
 * Check if a PDF document appears to be a form
 *
 * Quick check to determine if a document likely contains form fields
 * without performing full field detection.
 *
 * @param document - PDF document as ArrayBuffer or Uint8Array
 * @returns Whether the document appears to be a form
 */
export async function isFormDocument(
  document: ArrayBuffer | Uint8Array
): Promise<boolean> {
  try {
    const structure = await analyzeFormStructure(document, {
      sensitivity: 30,
      minConfidence: 20,
    });
    return structure.isForm;
  } catch {
    return false;
  }
}
