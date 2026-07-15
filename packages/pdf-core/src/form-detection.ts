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
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, TextItem as PDFJSTextItem } from 'pdfjs-dist/types/src/display/api';
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
          confidence: 95,
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
 * Extract text content with positions from a PDF page.
 */
async function extractTextContent(
  pdfDoc: PDFDocumentProxy,
  pageIndex: number
): Promise<TextItem[]> {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const content = await page.getTextContent();
  return content.items
    .filter((item): item is PDFJSTextItem => 'str' in item)
    .map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: Math.max(item.height, Math.abs(item.transform[3])),
    }));
}

function fieldTypeAllowed(type: FormFieldType, options: FormDetectionOptions): boolean {
  if ((type === 'text' || type === 'email' || type === 'phone' || type === 'number' || type === 'textarea') && options.detectText === false) return false;
  if (type === 'checkbox' && options.detectCheckboxes === false) return false;
  if (type === 'radio' && options.detectRadio === false) return false;
  if (type === 'dropdown' && options.detectDropdowns === false) return false;
  if (type === 'signature' && options.detectSignatures === false) return false;
  if (type === 'date' && options.detectDates === false) return false;
  return true;
}

function existingFieldType(field: unknown): FormFieldType {
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFDropdown || field instanceof PDFOptionList) return 'dropdown';
  if (field instanceof PDFSignature) return 'signature';
  if (field instanceof PDFTextField && field.isMultiline()) return 'textarea';
  return 'text';
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
  const selectedPages = new Set(pagesToAnalyze.filter((page) => page >= 1 && page <= pageCount));
  const detectionOptions: FormDetectionOptions = {
    detectText,
    detectCheckboxes,
    detectRadio,
    detectDropdowns,
    detectSignatures,
    detectDates,
  };

  reportProgress(0, 100);
  reportProgress(1, 0);

  const detectedFields: DetectedField[] = [];
  const occupied: Array<{ page: number; bounds: FieldBounds }> = [];
  const pages = pdfDoc.getPages();

  const addField = (field: DetectedField) => {
    if (field.confidence < minConfidence || !fieldTypeAllowed(field.type, detectionOptions)) return;
    const overlaps = occupied.some((entry) => {
      if (entry.page !== field.page) return false;
      const a = entry.bounds;
      const b = field.bounds;
      const overlapWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const overlapHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      return overlapWidth * overlapHeight > Math.min(a.width * a.height, b.width * b.height) * 0.5;
    });
    if (!overlaps) {
      detectedFields.push(field);
      occupied.push({ page: field.page, bounds: field.bounds });
    }
  };

  // Existing AcroForm widgets are definitive, not heuristic detections.
  for (const field of pdfDoc.getForm().getFields()) {
    const type = existingFieldType(field);
    const name = field.getName();
    const label = name.split('.').at(-1)?.replace(/[_-]+/g, ' ') || name;
    const widgets = field.acroField.getWidgets();
    const options = field instanceof PDFDropdown || field instanceof PDFOptionList
      ? field.getOptions()
      : field instanceof PDFRadioGroup
        ? field.getOptions()
        : undefined;
    for (let widgetIndex = 0; widgetIndex < widgets.length; widgetIndex++) {
      const widget = widgets[widgetIndex]!;
      const pageRef = widget.P();
      const pageIndex = pages.findIndex((page) =>
        pageRef !== undefined && page.ref.toString() === pageRef.toString()
      );
      const pageNumber = pageIndex >= 0 ? pageIndex + 1 : 1;
      if (!selectedPages.has(pageNumber)) continue;
      const rectangle = widget.getRectangle();
      addField({
        id: `${generateFieldName(name)}_${widgetIndex + 1}`,
        type,
        label,
        bounds: {
          x: rectangle.x,
          y: rectangle.y,
          width: rectangle.width,
          height: rectangle.height,
        },
        page: pageNumber,
        confidence: 100,
        name,
        required: field.isRequired(),
        options,
      });
    }
  }

  const textDocument = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  try {
    for (let i = 0; i < pagesToAnalyze.length; i++) {
      const pageNum = pagesToAnalyze[i]!;
      if (!selectedPages.has(pageNum)) continue;
      const page = pdfDoc.getPage(pageNum - 1);
      const { width } = page.getSize();
      const textContent = await extractTextContent(textDocument, pageNum - 1);
      const candidates: Array<{ bounds: FieldBounds; type?: FormFieldType }> = [
        ...detectUnderlines(textContent, width, page.getHeight()).map((bounds) => ({ bounds })),
        ...detectBoxes(textContent, width, page.getHeight()).map((box) => ({
          bounds: box.bounds,
          type: box.type,
        })),
      ];

      for (const candidate of candidates) {
        const nearby = findNearbyLabels(textContent, candidate.bounds, pageNum);
        const rawLabel = nearby[0]?.text.replace(/[:*\s]+$/, '').trim();
        const label = rawLabel || 'Unlabeled field';
        const suggestion = candidate.type
          ? { type: candidate.type, confidence: 90 }
          : suggestFieldTypes(label);
        const confidence = Math.min(
          98,
          58 + (rawLabel ? 22 : 0) + (suggestion.confidence - 50) * 0.2 + (sensitivity - 50) * 0.2,
        );
        addField({
          id: generateFieldId(),
          type: suggestion.type,
          label,
          bounds: candidate.bounds,
          page: pageNum,
          confidence,
          name: generateFieldName(rawLabel || `${suggestion.type}_${pageNum}_${candidate.bounds.x}`),
          required: rawLabel ? isRequiredField(nearby[0]!.text) : false,
          placeholder: rawLabel ? `Enter ${rawLabel.toLowerCase()}` : undefined,
          validationPattern:
            suggestion.type === 'email'
              ? '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
              : suggestion.type === 'phone'
                ? '^[\\d\\s\\-\\(\\)\\+]+$'
                : undefined,
        });
      }

      // A recognized label followed by available horizontal space is also a
      // candidate even when the PDF does not encode an underline glyph.
      for (const item of textContent) {
        const label = item.str.replace(/[:*\s]+$/, '').trim();
        if (!/[:*]\s*$/.test(item.str) || label.length < 2) continue;
        const suggestion = suggestFieldTypes(label);
        if (suggestion.confidence <= 50) continue;
        const x = item.x + item.width + 8;
        const availableWidth = width - x - 20;
        if (availableWidth < 72) continue;
        addField({
          id: generateFieldId(),
          type: suggestion.type,
          label,
          bounds: {
            x,
            y: item.y - 4,
            width: Math.min(240, availableWidth),
            height: Math.max(20, item.height + 8),
          },
          page: pageNum,
          confidence: Math.min(92, 60 + (suggestion.confidence - 50) * 0.5 + (sensitivity - 50) * 0.1),
          name: generateFieldName(label),
          required: isRequiredField(item.str),
          placeholder: `Enter ${label.toLowerCase()}`,
        });
      }

      reportProgress(1, ((i + 1) / pagesToAnalyze.length) * 100, i + 1, pagesToAnalyze.length);
    }
  } finally {
    await textDocument.destroy();
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
    const form = pdfDoc.getForm();
    const usedNames = new Set(form.getFields().map((field) => field.getName()));

    const uniqueName = (requested: string): string => {
      const base = generateFieldName(requested);
      let name = base;
      let suffix = 2;
      while (usedNames.has(name)) name = `${base}_${suffix++}`;
      usedNames.add(name);
      return name;
    };

    // Create form fields
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]!;

      if (field.page < 1 || field.page > pageCount) {
        continue;
      }

      const page = pdfDoc.getPage(field.page - 1);

      const appearance = {
        x: field.bounds.x,
        y: field.bounds.y,
        width: field.bounds.width,
        height: field.bounds.height,
        backgroundColor: rgb(bgColor.r, bgColor.g, bgColor.b),
        borderColor: rgb(bdColor.r, bdColor.g, bdColor.b),
        borderWidth: 1,
        textColor: rgb(0.1, 0.1, 0.1),
        font,
      };
      const name = uniqueName(field.name || field.label);

      if (field.type === 'checkbox') {
        const checkBox = form.createCheckBox(name);
        if (field.required) checkBox.enableRequired();
        checkBox.addToPage(page, appearance);
      } else if (field.type === 'radio') {
        const radio = form.createRadioGroup(name);
        if (field.required) radio.enableRequired();
        const options = field.options?.length ? field.options : [field.label];
        const optionWidth = field.bounds.width / options.length;
        options.forEach((option, optionIndex) => radio.addOptionToPage(option, page, {
          ...appearance,
          x: field.bounds.x + optionIndex * optionWidth,
          width: Math.min(optionWidth, field.bounds.height),
        }));
      } else if (field.type === 'dropdown') {
        const dropdown = form.createDropdown(name);
        if (field.options?.length) dropdown.setOptions(field.options);
        if (field.required) dropdown.enableRequired();
        dropdown.addToPage(page, appearance);
      } else {
        const textField = form.createTextField(name);
        if (field.type === 'textarea') textField.enableMultiline();
        if (field.required) textField.enableRequired();
        textField.addToPage(page, appearance);
        // pdf-lib creates the default appearance entry when the widget is
        // added to a page. Setting the font size before addToPage throws a
        // MissingDAEntryError for every newly-created text field.
        textField.setFontSize(Math.min(fontSize, Math.max(4, field.bounds.height * 0.6)));
      }

      reportProgress(1, ((i + 1) / fields.length) * 100, i + 1, fields.length);
    }

    form.updateFieldAppearances(font);
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
 * Extracts existing AcroForm field widgets from a PDF.
 *
 * @param document - PDF document as ArrayBuffer or Uint8Array
 * @returns Array of form field definitions
 */
export async function getFormFields(
  document: ArrayBuffer | Uint8Array
): Promise<DetectedField[]> {
  const bytes = getPDFBytes(document);
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  const fields: DetectedField[] = [];
  const pages = pdfDoc.getPages();
  for (const field of pdfDoc.getForm().getFields()) {
    const type = existingFieldType(field);
    const name = field.getName();
    const label = name.split('.').at(-1)?.replace(/[_-]+/g, ' ') || name;
    const options = field instanceof PDFDropdown || field instanceof PDFOptionList
      ? field.getOptions()
      : field instanceof PDFRadioGroup
        ? field.getOptions()
        : undefined;
    const widgets = field.acroField.getWidgets();
    for (let widgetIndex = 0; widgetIndex < widgets.length; widgetIndex++) {
      const widget = widgets[widgetIndex]!;
      const rectangle = widget.getRectangle();
      const pageRef = widget.P();
      const pageIndex = pages.findIndex((page) =>
        pageRef !== undefined && page.ref.toString() === pageRef.toString()
      );
      fields.push({
        id: `${generateFieldName(name)}_${widgetIndex + 1}`,
        type,
        label,
        bounds: {
          x: rectangle.x,
          y: rectangle.y,
          width: rectangle.width,
          height: rectangle.height,
        },
        page: pageIndex >= 0 ? pageIndex + 1 : 1,
        confidence: 100,
        name,
        required: field.isRequired(),
        options,
      });
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
