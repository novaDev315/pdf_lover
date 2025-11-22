# PDFLover Quick Start Implementation Guide

## Immediate Actions (Start Now)

### Team A: Infrastructure Setup
```bash
# Initialize the monorepo
cd /home/user/pdf_lover
bun init -y
bun add -d turbo typescript @types/bun

# Create turbo.json
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {}
  }
}
EOF

# Create workspace structure
mkdir -p apps/web apps/api packages/shared packages/pdf-core
```

### Team B: Frontend Foundation
```bash
# Create React app with Vite
cd /home/user/pdf_lover/apps
bun create vite web --template react-ts
cd web

# Install React 19 RC
bun add react@rc react-dom@rc
bun add -d @vitejs/plugin-react-swc @types/react @types/react-dom

# Setup shadcn/ui
bunx shadcn@latest init -y
bunx shadcn@latest add button card dialog dropdown-menu toast

# Install core PDF libraries
bun add pdfjs-dist@4 pdf-lib@1.17
bun add zustand@5 immer dexie@4 dexie-react-hooks
```

### Team C: Shared Packages
```bash
# Setup shared types package
cd /home/user/pdf_lover/packages/shared
bun init -y
cat > package.json << 'EOF'
{
  "name": "@pdflover/shared",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
EOF

# Setup pdf-core package
cd /home/user/pdf_lover/packages/pdf-core
bun init -y
bun add pdf-lib@1.17 jszip@3.10
```

## Core Implementation Files

### 1. PDF Viewer Component (Priority 1)
```typescript
// apps/web/src/components/pdf/PdfViewer.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.entry';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  file: File | string;
  onLoad?: (pdf: pdfjsLib.PDFDocumentProxy) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, onLoad }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);

  useEffect(() => {
    const loadPdf = async () => {
      const loadingTask = pdfjsLib.getDocument(
        typeof file === 'string' ? file : URL.createObjectURL(file)
      );
      const pdfDoc = await loadingTask.promise;
      setPdf(pdfDoc);
      onLoad?.(pdfDoc);
      renderPage(pdfDoc, 1);
    };

    loadPdf();
  }, [file]);

  const renderPage = async (pdfDoc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d')!;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
  };

  return (
    <div className="pdf-viewer">
      <canvas ref={canvasRef} />
      {/* Add controls here */}
    </div>
  );
};
```

### 2. PDF Store (Priority 1)
```typescript
// apps/web/src/store/pdf-store.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface PdfState {
  documents: Map<string, PDFDocumentProxy>;
  activeDocument: string | null;
  currentPage: number;
  scale: number;
  annotations: Map<string, any[]>;

  // Actions
  loadDocument: (id: string, pdf: PDFDocumentProxy) => void;
  setActiveDocument: (id: string) => void;
  setCurrentPage: (page: number) => void;
  setScale: (scale: number) => void;
  addAnnotation: (docId: string, annotation: any) => void;
}

export const usePdfStore = create<PdfState>()(
  immer((set) => ({
    documents: new Map(),
    activeDocument: null,
    currentPage: 1,
    scale: 1.5,
    annotations: new Map(),

    loadDocument: (id, pdf) =>
      set((state) => {
        state.documents.set(id, pdf);
        if (!state.activeDocument) {
          state.activeDocument = id;
        }
      }),

    setActiveDocument: (id) =>
      set((state) => {
        state.activeDocument = id;
      }),

    setCurrentPage: (page) =>
      set((state) => {
        state.currentPage = page;
      }),

    setScale: (scale) =>
      set((state) => {
        state.scale = scale;
      }),

    addAnnotation: (docId, annotation) =>
      set((state) => {
        if (!state.annotations.has(docId)) {
          state.annotations.set(docId, []);
        }
        state.annotations.get(docId)?.push(annotation);
      }),
  }))
);
```

### 3. PDF Core Operations (Priority 1)
```typescript
// packages/pdf-core/src/merge.ts
import { PDFDocument } from 'pdf-lib';

export async function mergePdfs(pdfs: ArrayBuffer[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (const pdfBuffer of pdfs) {
    const pdf = await PDFDocument.load(pdfBuffer);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  }

  return mergedPdf.save();
}

// packages/pdf-core/src/split.ts
export async function splitPdf(
  pdfBuffer: ArrayBuffer,
  ranges: Array<[number, number]>
): Promise<Uint8Array[]> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const results: Uint8Array[] = [];

  for (const [start, end] of ranges) {
    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(
      pdf,
      Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i)
    );
    pages.forEach((page) => newPdf.addPage(page));
    results.push(await newPdf.save());
  }

  return results;
}
```

### 4. IndexedDB Storage (Priority 1)
```typescript
// apps/web/src/lib/storage/indexeddb.ts
import Dexie, { type Table } from 'dexie';

export interface StoredFile {
  id?: number;
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id?: number;
  documentId: number;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

class PDFLoverDB extends Dexie {
  files!: Table<StoredFile>;
  conversations!: Table<Conversation>;

  constructor() {
    super('PDFLoverDB');
    this.version(1).stores({
      files: '++id, name, createdAt, updatedAt',
      conversations: '++id, documentId, createdAt',
    });
  }

  async saveFile(file: File): Promise<number> {
    const buffer = await file.arrayBuffer();
    return this.files.add({
      name: file.name,
      size: file.size,
      type: file.type,
      data: buffer,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async getFile(id: number): Promise<StoredFile | undefined> {
    return this.files.get(id);
  }

  async deleteFile(id: number): Promise<void> {
    await this.files.delete(id);
    // Also delete related conversations
    await this.conversations.where('documentId').equals(id).delete();
  }
}

export const db = new PDFLoverDB();
```

### 5. Web Worker Setup (Priority 2)
```typescript
// apps/web/src/workers/pdf.worker.ts
import { expose } from 'comlink';
import { mergePdfs, splitPdf } from '@pdflover/pdf-core';

const pdfWorker = {
  async merge(pdfs: ArrayBuffer[]): Promise<Uint8Array> {
    return mergePdfs(pdfs);
  },

  async split(pdf: ArrayBuffer, ranges: Array<[number, number]>): Promise<Uint8Array[]> {
    return splitPdf(pdf, ranges);
  },

  async compress(pdf: ArrayBuffer, quality: number): Promise<Uint8Array> {
    // Implementation here
    return new Uint8Array();
  },
};

expose(pdfWorker);

// apps/web/src/lib/workers/manager.ts
import { wrap } from 'comlink';

export function createPdfWorker() {
  const worker = new Worker(
    new URL('../../workers/pdf.worker.ts', import.meta.url),
    { type: 'module' }
  );
  return wrap(worker);
}
```

## Docker Development Setup

### docker/docker-compose.dev.yml
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: pdflover
      POSTGRES_USER: pdflover
      POSTGRES_PASSWORD: pdflover123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Parallel Development Strategy

### Team Assignments

**Team A (Infrastructure & Tools)**
- Day 1-2: Monorepo setup, build configuration
- Day 3-4: PDF core library implementation
- Day 5-6: Web Workers, compression algorithms

**Team B (UI & Components)**
- Day 1-2: React setup, component library
- Day 3-4: PDF viewer, controls, thumbnails
- Day 5-6: Tool panels (merge, split, convert)

**Team C (Storage & State)**
- Day 1-2: Zustand stores setup
- Day 3-4: IndexedDB integration
- Day 5-6: File manager UI

### Daily Sync Points
1. **Morning**: Review overnight progress
2. **Midday**: Integration check
3. **Evening**: Commit and merge

### Integration Milestones

**Day 3**: Basic PDF viewing working
**Day 5**: Merge/split operations functional
**Day 7**: Storage and state management complete
**Day 10**: AI chat integration started
**Day 14**: MVP feature complete

## Testing Strategy

### Unit Tests (Start Day 2)
```bash
bun add -d vitest @testing-library/react @testing-library/user-event
```

### E2E Tests (Start Day 5)
```bash
bun add -d @playwright/test
```

## Performance Monitoring

### Key Metrics to Track
- Bundle size (target: <2MB initial)
- First paint (<1.5s)
- PDF render time (<2s for 10MB)
- Memory usage (<500MB for large PDFs)

## Success Criteria for Phase 1

- [ ] Can view PDF files
- [ ] Can merge multiple PDFs
- [ ] Can split PDFs
- [ ] Files persist in IndexedDB
- [ ] Basic UI is responsive
- [ ] No memory leaks
- [ ] Works offline

## Next Steps

1. **Immediate**: Run Team A setup commands
2. **Hour 1**: Initialize monorepo structure
3. **Hour 2**: Setup React app with Vite
4. **Hour 3**: Install core dependencies
5. **Hour 4**: Create first PDF viewer component
6. **Day 1 End**: Basic PDF viewing functional

## Support & Resources

- PDF.js Documentation: https://mozilla.github.io/pdf.js/
- pdf-lib Documentation: https://pdf-lib.js.org/
- Zustand Documentation: https://zustand-demo.pmnd.rs/
- Dexie Documentation: https://dexie.org/

## Common Issues & Solutions

### Issue: PDF.js worker not loading
```javascript
// Solution: Use CDN worker or bundle it
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
```

### Issue: CORS errors with local files
```javascript
// Solution: Convert to blob URL
const url = URL.createObjectURL(file);
// Remember to revoke when done
URL.revokeObjectURL(url);
```

### Issue: Large PDF memory issues
```javascript
// Solution: Implement pagination and cleanup
pdf.cleanup(); // Clean up resources
pdf.destroy(); // Destroy document
```

## Commit Message Format
```
feat(pdf): add merge functionality
fix(viewer): resolve zoom issue
docs: update API documentation
```

Remember: NO "Generated by Claude" or "Co-authored-by" in commits!