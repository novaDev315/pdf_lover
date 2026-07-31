import type { LucideIcon } from 'lucide-react';
import {
  Combine,
  Crop,
  FilePenLine,
  FileSearch,
  FileSignature,
  GitCompareArrows,
  Images,
  ListChecks,
  ListOrdered,
  ListTree,
  MessageSquareText,
  Minimize2,
  PanelsTopLeft,
  RefreshCw,
  ScanSearch,
  Scissors,
  ShieldCheck,
  Stamp,
  Table2,
  Tags,
} from 'lucide-react';

export type ToolCategoryId = 'organize' | 'edit' | 'convert' | 'understand';

export interface ToolCategory {
  id: ToolCategoryId;
  name: string;
  description: string;
  iconClass: string;
  surfaceClass: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  path: string;
  category: ToolCategoryId;
  icon: LucideIcon;
  keywords: string[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'organize',
    name: 'Organize',
    description: 'Combine, separate, compress, and process document sets.',
    iconClass: 'text-blue-700 dark:text-blue-300',
    surfaceClass: 'bg-blue-100 dark:bg-blue-950/70',
  },
  {
    id: 'edit',
    name: 'Edit & protect',
    description: 'Change pages, add content, sign, and secure documents.',
    iconClass: 'text-violet-700 dark:text-violet-300',
    surfaceClass: 'bg-violet-100 dark:bg-violet-950/70',
  },
  {
    id: 'convert',
    name: 'Convert & extract',
    description: 'Move PDF content into useful image, document, and table formats.',
    iconClass: 'text-amber-700 dark:text-amber-300',
    surfaceClass: 'bg-amber-100 dark:bg-amber-950/70',
  },
  {
    id: 'understand',
    name: 'Review & understand',
    description: 'Search, compare, classify, and analyze document content.',
    iconClass: 'text-emerald-700 dark:text-emerald-300',
    surfaceClass: 'bg-emerald-100 dark:bg-emerald-950/70',
  },
];

export const TOOL_CATALOG: ToolDefinition[] = [
  {
    id: 'merge',
    name: 'Merge PDFs',
    description: 'Combine multiple PDF files into one ordered document.',
    path: '/merge',
    category: 'organize',
    icon: Combine,
    keywords: ['join', 'combine', 'pages'],
  },
  {
    id: 'split',
    name: 'Split PDF',
    description: 'Extract page ranges or split a document into separate files.',
    path: '/split',
    category: 'organize',
    icon: Scissors,
    keywords: ['extract pages', 'separate', 'ranges'],
  },
  {
    id: 'compress',
    name: 'Compress PDF',
    description: 'Reduce file size with selectable quality levels.',
    path: '/compress',
    category: 'organize',
    icon: Minimize2,
    keywords: ['reduce', 'optimize', 'size'],
  },
  {
    id: 'batch',
    name: 'Batch processing',
    description: 'Run repeatable operations across several PDFs in one queue.',
    path: '/batch',
    category: 'organize',
    icon: ListChecks,
    keywords: ['bulk', 'queue', 'multiple files'],
  },
  {
    id: 'editor',
    name: 'PDF editor',
    description: 'Annotate, draw, add form controls, and save document versions.',
    path: '/editor',
    category: 'edit',
    icon: FilePenLine,
    keywords: ['annotate', 'draw', 'forms', 'redact'],
  },
  {
    id: 'crop-resize',
    name: 'Crop, resize & trim',
    description: 'Change page dimensions, crop areas, or remove empty margins.',
    path: '/crop-resize',
    category: 'edit',
    icon: Crop,
    keywords: ['margins', 'page size', 'a4', 'a5'],
  },
  {
    id: 'watermark',
    name: 'Watermark',
    description: 'Apply positioned text or image watermarks to PDF pages.',
    path: '/watermark',
    category: 'edit',
    icon: Stamp,
    keywords: ['stamp', 'brand', 'overlay'],
  },
  {
    id: 'page-numbers',
    name: 'Page numbers & headers',
    description: 'Add page numbering, headers, and footers with templates.',
    path: '/page-numbers',
    category: 'edit',
    icon: ListOrdered,
    keywords: ['footer', 'header', 'numbering'],
  },
  {
    id: 'signature',
    name: 'Sign PDF',
    description: 'Add a visual signature or apply a PKCS#12 digital signature.',
    path: '/signature',
    category: 'edit',
    icon: FileSignature,
    keywords: ['certificate', 'digital signature', 'stamp'],
  },
  {
    id: 'security',
    name: 'Encrypt & decrypt',
    description: 'Protect PDFs with AES encryption or remove known passwords.',
    path: '/security',
    category: 'edit',
    icon: ShieldCheck,
    keywords: ['password', 'protect', 'unlock', 'aes'],
  },
  {
    id: 'convert',
    name: 'Convert PDF',
    description: 'Convert PDFs to images, text, Office documents, and more.',
    path: '/convert',
    category: 'convert',
    icon: RefreshCw,
    keywords: ['docx', 'xlsx', 'pptx', 'image', 'text'],
  },
  {
    id: 'extract-images',
    name: 'Extract images',
    description: 'Find and export embedded images from PDF pages.',
    path: '/extract-images',
    category: 'convert',
    icon: Images,
    keywords: ['pictures', 'export', 'embedded'],
  },
  {
    id: 'extract-tables',
    name: 'Extract tables',
    description: 'Detect tabular content and export it as CSV or JSON.',
    path: '/extract-tables',
    category: 'convert',
    icon: Table2,
    keywords: ['csv', 'spreadsheet', 'data'],
  },
  {
    id: 'search',
    name: 'Search & overlay',
    description: 'Search document text and add visible replacement overlays.',
    path: '/search',
    category: 'understand',
    icon: FileSearch,
    keywords: ['find', 'replace', 'text'],
  },
  {
    id: 'compare',
    name: 'Compare PDFs',
    description: 'Find textual and visual changes between two documents.',
    path: '/compare',
    category: 'understand',
    icon: GitCompareArrows,
    keywords: ['diff', 'changes', 'revisions'],
  },
  {
    id: 'toc',
    name: 'Table of contents',
    description: 'Detect headings and generate a navigable contents page.',
    path: '/toc',
    category: 'understand',
    icon: ListTree,
    keywords: ['headings', 'outline', 'navigation'],
  },
  {
    id: 'form-detection',
    name: 'Detect form fields',
    description: 'Recognize likely form controls and generate fillable fields.',
    path: '/form-detection',
    category: 'understand',
    icon: PanelsTopLeft,
    keywords: ['fillable', 'acroform', 'fields'],
  },
  {
    id: 'classify',
    name: 'Classify document',
    description: 'Identify the document type and its detected entities.',
    path: '/classify',
    category: 'understand',
    icon: Tags,
    keywords: ['category', 'type', 'entities'],
  },
  {
    id: 'key-info',
    name: 'Extract key information',
    description: 'Find dates, amounts, contacts, references, and other key data.',
    path: '/key-info',
    category: 'understand',
    icon: ScanSearch,
    keywords: ['dates', 'amounts', 'email', 'references'],
  },
  {
    id: 'chat',
    name: 'Chat with PDF',
    description: 'Ask questions using a local model or configured cloud AI.',
    path: '/chat',
    category: 'understand',
    icon: MessageSquareText,
    keywords: ['ai', 'questions', 'rag', 'summary'],
  },
];

export function findTools(query: string, category: ToolCategoryId | 'all'): ToolDefinition[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return TOOL_CATALOG.filter((tool) => {
    if (category !== 'all' && tool.category !== category) return false;
    if (!normalizedQuery) return true;
    return [tool.name, tool.description, ...tool.keywords]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
}
