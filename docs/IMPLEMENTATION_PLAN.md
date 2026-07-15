# PDFLover - Complete Implementation Plan

> Historical design snapshot. This document describes an earlier optional
> backend and Docker Compose proposal and is not the current implementation or
> deployment contract. See `ARCHITECTURE.md` and the repository's
> `homelab.yaml` for current source-of-truth boundaries.

## Architecture Philosophy: Local-First

> **Core Principle**: ALL PDF processing happens in the browser. No files are uploaded to servers.
> The backend is **OPTIONAL** and only used for cloud AI and collaborative features (with explicit user consent).

### What Runs Locally (Browser)
- PDF viewing, editing, annotations
- Merge, split, rotate, reorder pages
- Convert (PDF ↔ images, HTML, Markdown)
- Compress and optimize
- Encrypt, sign, watermark
- OCR (Tesseract.js)
- AI chat (Transformers.js + WebGPU)
- All file storage (IndexedDB)

### What Uses Backend (Optional, Opt-in Only)
- Cloud AI models via OpenRouter (user provides API key)
- Cloud backup/sync
- Collaborative editing
- Complex OCR fallback
- Proprietary format conversion (Word/Excel/PowerPoint)

---

## Tech Stack

| Layer | Technology | Location |
|-------|------------|----------|
| **Runtime** | Bun 1.x | Build/Dev |
| **Monorepo** | Turborepo + Bun workspaces | Build |
| **Frontend** | React 19, TypeScript 5.x, shadcn/ui, TailwindCSS 4, Vite 6 | Browser |
| **PDF Processing** | PDF.js (render), pdf-lib (manipulate), Tesseract.js (OCR) | Browser |
| **AI Local** | Transformers.js, WebGPU, LangChain.js | Browser |
| **Storage** | IndexedDB (Dexie.js), Cache API | Browser |
| **State** | Zustand | Browser |
| **PWA** | Workbox, Service Workers | Browser |
| **Backend (Optional)** | NestJS 10, TypeORM, PostgreSQL 16, Redis 7 | Server |
| **Deploy** | Docker, Docker Compose, Static CDN | Server |

---

## Project Structure

```
pdf_lover/
├── apps/
│   ├── web/                          # React 19 Frontend
│   │   ├── public/
│   │   │   ├── manifest.json         # PWA manifest
│   │   │   └── sw.js                 # Service worker
│   │   ├── src/
│   │   │   ├── app/                  # App entry & routing
│   │   │   ├── components/
│   │   │   │   ├── ui/               # shadcn components
│   │   │   │   ├── layout/           # Dashboard, Sidebar, Header
│   │   │   │   ├── pdf/              # PDF Viewer/Editor components
│   │   │   │   │   ├── PdfViewer.tsx
│   │   │   │   │   ├── PageThumbnails.tsx
│   │   │   │   │   ├── AnnotationLayer.tsx
│   │   │   │   │   ├── EditToolbar.tsx
│   │   │   │   │   └── SignaturePanel.tsx
│   │   │   │   ├── tools/            # Tool-specific components
│   │   │   │   │   ├── MergePanel.tsx
│   │   │   │   │   ├── SplitPanel.tsx
│   │   │   │   │   ├── ConvertPanel.tsx
│   │   │   │   │   ├── CompressPanel.tsx
│   │   │   │   │   └── SecurityPanel.tsx
│   │   │   │   ├── chat/             # AI Chat components
│   │   │   │   │   ├── ChatPanel.tsx
│   │   │   │   │   ├── MessageBubble.tsx
│   │   │   │   │   ├── CitationLink.tsx
│   │   │   │   │   └── SuggestedQuestions.tsx
│   │   │   │   └── file-manager/     # File management
│   │   │   │       ├── FileGrid.tsx
│   │   │   │       ├── FileList.tsx
│   │   │   │       └── FilePreview.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── usePdfDocument.ts
│   │   │   │   ├── useLocalStorage.ts
│   │   │   │   ├── useIndexedDB.ts
│   │   │   │   └── useWebGPU.ts
│   │   │   ├── lib/
│   │   │   │   ├── pdf/              # PDF processing utilities
│   │   │   │   │   ├── merge.ts
│   │   │   │   │   ├── split.ts
│   │   │   │   │   ├── convert.ts
│   │   │   │   │   ├── compress.ts
│   │   │   │   │   ├── encrypt.ts
│   │   │   │   │   └── ocr.ts
│   │   │   │   ├── ai/               # AI utilities
│   │   │   │   │   ├── embeddings.ts
│   │   │   │   │   ├── local-llm.ts
│   │   │   │   │   └── openrouter.ts
│   │   │   │   └── storage/          # Storage utilities
│   │   │   │       ├── indexeddb.ts
│   │   │   │       └── cache.ts
│   │   │   ├── store/                # Zustand stores
│   │   │   │   ├── pdf-store.ts
│   │   │   │   ├── chat-store.ts
│   │   │   │   ├── settings-store.ts
│   │   │   │   └── file-store.ts
│   │   │   └── pages/
│   │   │       ├── Dashboard.tsx
│   │   │       ├── Editor.tsx
│   │   │       ├── Tools.tsx
│   │   │       └── Settings.tsx
│   │   ├── vite.config.ts
│   │   └── Dockerfile
│   │
│   └── api/                          # NestJS Backend (OPTIONAL - Cloud Features Only)
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── modules/
│       │   │   ├── ai/               # Cloud AI proxy (OpenRouter)
│       │   │   │   ├── ai.module.ts
│       │   │   │   ├── ai.controller.ts
│       │   │   │   ├── ai.service.ts
│       │   │   │   └── openrouter.service.ts
│       │   │   ├── sync/             # Optional cloud backup/sync
│       │   │   │   ├── sync.module.ts
│       │   │   │   └── sync.service.ts
│       │   │   ├── convert/          # Fallback for proprietary formats only
│       │   │   │   ├── convert.module.ts
│       │   │   │   └── convert.service.ts  # Word/Excel/PPT only
│       │   │   └── websocket/
│       │   │       ├── websocket.module.ts
│       │   │       └── websocket.gateway.ts
│       │   ├── entities/
│       │   │   ├── user.entity.ts          # Optional accounts
│       │   │   └── sync-metadata.entity.ts # Cloud sync only
│       │   └── config/
│       │       └── app.config.ts
│       ├── test/
│       └── Dockerfile
│
├── packages/
│   ├── shared/                       # Shared types & utilities
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── constants/
│   │   │   └── utils/
│   │   └── package.json
│   ├── pdf-core/                     # PDF processing core
│   │   ├── src/
│   │   │   ├── merge.ts
│   │   │   ├── split.ts
│   │   │   ├── convert.ts
│   │   │   ├── compress.ts
│   │   │   └── security.ts
│   │   └── package.json
│   └── ui/                           # Shared UI (if needed)
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml            # Production
│   ├── docker-compose.dev.yml        # Development
│   ├── nginx/
│   │   └── nginx.conf
│   └── postgres/
│       └── init.sql
│
├── turbo.json
├── package.json
├── bun.lockb
└── bunfig.toml
```

---

## Complete Feature Checklist (From PRD)

### Phase 1: Foundation & Core Tools (Weeks 1-4)

#### 1.1 Project Setup (Week 1)
- [ ] Initialize Turborepo with Bun workspaces
- [ ] Setup React 19 + Vite + TypeScript in `apps/web`
- [ ] Setup NestJS + TypeORM in `apps/api`
- [ ] Configure shadcn/ui with TailwindCSS 4
- [ ] Setup Zustand stores structure
- [ ] Create shared packages (`@pdflover/shared`, `@pdflover/pdf-core`)
- [ ] Configure ESLint, Prettier, TypeScript paths

#### 1.2 Docker Infrastructure (Week 1)
- [ ] `Dockerfile` for frontend (multi-stage, nginx)
- [ ] `Dockerfile` for backend (Bun runtime)
- [ ] `docker-compose.dev.yml`:
  - PostgreSQL 16
  - Redis 7
  - Hot-reload volumes
- [ ] `docker-compose.yml` (production):
  - All services with health checks
  - Nginx reverse proxy
  - Volume persistence

#### 1.3 Database & Backend Foundation (Week 1)
- [ ] TypeORM configuration with migrations
- [ ] Entity definitions:
  - `Document` (id, name, hash, metadata, createdAt)
  - `Conversation` (id, documentId, title, createdAt)
  - `Message` (id, conversationId, role, content, citations)
- [ ] Redis configuration for caching
- [ ] BullMQ setup for background jobs

#### 1.4 UI Foundation (Week 2)
- [ ] Dashboard layout with sidebar navigation
- [ ] Dark/light theme system
- [ ] Responsive design (1024px - 4K)
- [ ] Keyboard shortcuts system
- [ ] Drag-and-drop file upload component
- [ ] Toast notifications
- [ ] Loading states & skeletons

#### 1.5 PDF Viewer Core (Week 2)
- [ ] PDF.js integration
- [ ] Page navigation (prev/next/goto)
- [ ] Page thumbnails sidebar
- [ ] Zoom controls (fit-width, fit-page, percentage)
- [ ] Full-screen mode
- [ ] Touch gestures (pinch-to-zoom)
- [ ] Multi-tab document support

#### 1.6 Merge & Split Module - P0 (Week 3) **[100% Browser]**
- [ ] Combine multiple PDFs (pdf-lib)
- [ ] Split by page range (pdf-lib)
- [ ] Split by file size (pdf-lib)
- [ ] Extract specific pages (pdf-lib)
- [ ] Rotate pages (90°, 180°, 270°) (pdf-lib)
- [ ] Reorder pages via drag-and-drop
- [ ] Preview before processing
- [ ] Download result (Blob API)

#### 1.7 Convert Module - P0 (Week 3-4) **[Browser + Optional Server Fallback]**

**Browser-only conversions:**
- [ ] PDF to Image (JPG, PNG, SVG) - Canvas API
- [ ] Image to PDF (pdf-lib)
- [ ] HTML to PDF (html2pdf.js)
- [ ] Markdown to PDF (marked + html2pdf.js)
- [ ] Multiple file batch conversion
- [ ] OCR for scanned PDFs (Tesseract.js WebAssembly)

**Server fallback (opt-in, for proprietary formats):**
- [ ] PDF to Word (.docx) - requires LibreOffice
- [ ] PDF to Excel (.xlsx) - requires LibreOffice
- [ ] PDF to PowerPoint (.pptx) - requires LibreOffice
- [ ] User consent modal before any server upload
- [ ] Temporary file deletion after processing

#### 1.8 Compress Module - P1 (Week 4) **[100% Browser]**
- [ ] Lossless compression (pdf-lib optimization)
- [ ] Adjustable quality settings (low/medium/high)
- [ ] Image downsampling in browser
- [ ] Batch compression
- [ ] Preview before/after comparison
- [ ] Size estimation display

---

### Phase 2: Edit & Security (Weeks 5-6)

#### 2.1 Edit Module - P0 (Week 5) **[100% Browser]**
- [ ] Text editing and formatting (pdf-lib)
- [ ] Add/remove/reorder pages (pdf-lib)
- [ ] Insert images (pdf-lib)
- [ ] Insert shapes (rectangle, circle, arrow, line) - Canvas overlay
- [ ] Form field creation and editing (pdf-lib)
- [ ] Digital signature support (pdf-lib + Web Crypto API)
- [ ] Annotation tools (Canvas + pdf-lib):
  - Highlight
  - Underline
  - Strikethrough
  - Comments/sticky notes
  - Freehand drawing
- [ ] Redaction with permanent removal (pdf-lib)
- [ ] Undo/redo (50-step history) - Zustand middleware
- [ ] Properties panel for selected elements

#### 2.2 Security Module - P0 (Week 6) **[100% Browser]**
- [ ] Password protection 128/256-bit AES (pdf-lib encryption)
- [ ] Permission settings (pdf-lib):
  - Print allowed/denied
  - Copy allowed/denied
  - Edit allowed/denied
- [ ] Digital signatures (Web Crypto API + pdf-lib)
- [ ] Certificate validation (browser native)
- [ ] Watermarking text/image/diagonal (pdf-lib)
- [ ] Secure redaction - permanent removal (pdf-lib)

---

### Phase 3: AI Chat Integration (Weeks 7-8)

#### 3.1 Local AI (Browser WebGPU) - DEFAULT (Week 7) **[100% Browser]**
- [ ] Transformers.js integration
- [ ] WebGPU acceleration detection & graceful fallback
- [ ] Text extraction from PDF (pdf.js + custom parser)
- [ ] Vector embeddings in browser (Transformers.js)
- [ ] Semantic search with in-memory vector store
- [ ] Local inference with quantized models (Phi-3, Llama 3.2, Gemma 2)
- [ ] Context window management for large documents
- [ ] Incremental indexing stored in IndexedDB
- [ ] No data leaves the browser

#### 3.2 Cloud AI (OpenRouter) - OPTIONAL (Week 7) **[Opt-in Only]**
- [ ] Direct OpenRouter API calls from browser (user's API key)
- [ ] Optional: NestJS proxy for key management
- [ ] Model selection (GPT-4, Claude, Llama, Gemini, etc.)
- [ ] Streaming responses (EventSource/fetch streams)
- [ ] Clear consent modal before sending data
- [ ] Rate limiting & error handling
- [ ] Automatic fallback to local AI if cloud fails

#### 3.3 Chat with PDF - P0 (Week 8)

**Core Capabilities:**
- [ ] Natural language Q&A
- [ ] Summarization (full, sections, key points)
- [ ] Information extraction (dates, names, amounts)
- [ ] Translation of content
- [ ] Explain complex passages
- [ ] Generate study notes/outlines
- [ ] Cross-reference multiple documents

**User Experience:**
- [ ] Side-by-side layout (PDF + chat)
- [ ] Collapsible chat panel
- [ ] Clickable citations to source passages
- [ ] Conversation history per document
- [ ] Export chat transcripts (Markdown, JSON)
- [ ] Suggested questions based on document type
- [ ] Message bubbles with timestamps
- [ ] Code/quote formatting
- [ ] Copy response button
- [ ] Regenerate answer option

---

### Phase 4: Smart Features & File Management (Week 9)

#### 4.1 Smart Features - P1
- [ ] Auto-generate table of contents
- [ ] Extract all images/tables
- [ ] Form field auto-detection
- [ ] Language detection
- [ ] Document classification
- [ ] Sentiment analysis
- [ ] Key information extraction dashboard

#### 4.2 File Manager UI
- [ ] Dashboard with recent files
- [ ] Quick action tiles
- [ ] Storage usage indicator (local)
- [ ] Feature shortcuts
- [ ] List/grid view toggle
- [ ] Sort options (name, date, size)
- [ ] Filter options (type, date range)
- [ ] Bulk operations (delete, download, merge)
- [ ] File preview on hover

---

### Phase 5: Storage, PWA & Polish (Week 10)

#### 5.1 Local Storage Architecture **[Core of Local-First]**

**Primary Storage (IndexedDB via Dexie.js):**
- [ ] PDF documents storage (encrypted at rest option)
- [ ] Chat conversation history per document
- [ ] Vector embeddings for semantic search
- [ ] User settings and preferences
- [ ] Recent files and activity log

**Processing Strategy:**
- [ ] In-memory processing for files <50MB
- [ ] Chunked streaming for files 50-200MB
- [ ] Web Workers for CPU-intensive operations
- [ ] SharedArrayBuffer for large file handling

**Storage Management:**
- [ ] Storage quota management (50% of available disk)
- [ ] Automatic cleanup of temp files after 24h
- [ ] User-controlled permanent storage
- [ ] Export all data (GDPR compliance)
- [ ] One-click data deletion

**Caching:**
- [ ] Cache API for app assets (offline support)
- [ ] Session storage for current session state
- [ ] Memory cache for frequently accessed pages

#### 5.2 PWA Features
- [ ] Service worker with Workbox
- [ ] Offline functionality
- [ ] App manifest (installable)
- [ ] Camera integration for scanning
- [ ] Share sheet integration
- [ ] Background sync

#### 5.3 Accessibility (WCAG 2.1 AA)
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast compliance
- [ ] Focus indicators
- [ ] ARIA labels

#### 5.4 Performance Optimization
- [ ] First Contentful Paint: <1.5s
- [ ] Time to Interactive: <3s
- [ ] PDF load time: <2s for 10MB
- [ ] Operation completion: <5s
- [ ] Chat first token: <2s
- [ ] Code splitting & lazy loading
- [ ] WebAssembly optimization

---

### Phase 6: Backend API - OPTIONAL (Week 11-12)

> **Note**: The backend is NOT required for core functionality. The app works 100% offline.
> Backend is only needed for: Cloud AI proxy, proprietary format conversion, and cloud sync.

#### 6.1 REST API Endpoints (Optional Cloud Features Only)
```
# AI Proxy (when user wants to hide API key)
POST   /api/ai/chat          # Proxy to OpenRouter
POST   /api/ai/stream        # SSE streaming proxy

# Proprietary Format Conversion (opt-in)
POST   /api/convert/to-docx  # PDF → Word (LibreOffice)
POST   /api/convert/to-xlsx  # PDF → Excel (LibreOffice)
POST   /api/convert/to-pptx  # PDF → PowerPoint (LibreOffice)

# Cloud Sync (opt-in, requires account)
POST   /api/sync/upload      # Backup to cloud
GET    /api/sync/download    # Restore from cloud
DELETE /api/sync/delete      # Remove cloud data
```

#### 6.2 WebSocket (Real-time, Optional)
- [ ] AI streaming responses (SSE alternative)
- [ ] Collaborative editing (future Phase 2+)

#### 6.3 Cloud Features (All Opt-in with Explicit Consent)
- [ ] Cloud backup/sync with E2E encryption
- [ ] Cloud AI proxy (hide user API keys)
- [ ] Proprietary format conversion (LibreOffice server)
- [ ] Complex OCR for handwritten text (future)
- [ ] Temporary file auto-deletion after processing
- [ ] GDPR/CCPA compliant (data deletion on request)

#### 6.4 Privacy & Security Guarantees
- [ ] **No telemetry** - zero analytics by default
- [ ] **No account required** - all core features work anonymously
- [ ] **No file uploads** - unless user explicitly opts in
- [ ] **Data portability** - export everything in open formats
- [ ] **Right to deletion** - one-click remove all cloud data
- [ ] **Sandboxed processing** - all local ops in Web Workers
- [ ] **Open source** - fully auditable codebase

---

## Deployment Options

### Option 1: Static Hosting Only (Recommended for Privacy)
Frontend-only deployment. All features work except proprietary format conversion.

```yaml
# Can deploy to: Vercel, Netlify, Cloudflare Pages, GitHub Pages
# No server required - 100% client-side
```

### Option 2: Full Stack with Docker (For Cloud Features)

```yaml
# docker-compose.yml
services:
  # Frontend - Can also be deployed to CDN separately
  web:
    build: ./apps/web
    ports: ["3000:80"]
    # No backend dependency - works standalone

  # Backend - OPTIONAL, only for cloud features
  api:
    build: ./apps/api
    ports: ["3001:3001"]
    environment:
      - DATABASE_URL=postgres://pdflover:${DB_PASSWORD}@postgres:5432/pdflover
      - REDIS_URL=redis://redis:6379
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}  # Optional
    depends_on: [postgres, redis]

  # Only needed if using cloud sync
  postgres:
    image: postgres:16-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]
    environment:
      - POSTGRES_DB=pdflover
      - POSTGRES_USER=pdflover
      - POSTGRES_PASSWORD=${DB_PASSWORD}

  # Only needed for rate limiting / caching
  redis:
    image: redis:7-alpine
    volumes: [redis_data:/data]

  # Only needed for Word/Excel/PPT conversion
  libreoffice:
    image: libreoffice/libreoffice:latest
    # Used by api service for proprietary format conversion

volumes:
  postgres_data:
  redis_data:
```

### Option 3: Minimal Backend (AI Proxy Only)

```yaml
# docker-compose.minimal.yml
services:
  web:
    build: ./apps/web
    ports: ["3000:80"]

  api:
    build: ./apps/api
    ports: ["3001:3001"]
    environment:
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    # No database needed - just proxies AI requests
```

---

## Implementation Order Summary

| Week | Focus | Key Deliverables | Location |
|------|-------|------------------|----------|
| 1 | Foundation | Turborepo + Bun, Docker dev setup | Build |
| 2 | UI Core | React 19 + shadcn, PDF viewer | Browser |
| 3 | Core Tools | Merge, Split, Convert (P0) | Browser |
| 4 | More Tools | Convert completion, Compress (P1) | Browser |
| 5 | Edit | Annotations, text editing (P0) | Browser |
| 6 | Security | Encryption, signatures, watermarks (P0) | Browser |
| 7 | AI Setup | Transformers.js (local) + OpenRouter (cloud) | Browser + Optional Server |
| 8 | Chat | Chat with PDF UI (P0) | Browser |
| 9 | Smart | Smart features (P1), File manager | Browser |
| 10 | Polish | PWA, accessibility, performance | Browser |
| 11-12 | Backend | Optional cloud features only | Server (Optional) |

---

## Local-First Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (100%)                          │
├─────────────────────────────────────────────────────────────────┤
│  PDF Processing      │  AI Chat           │  Storage            │
│  ─────────────────   │  ────────────────  │  ────────────────   │
│  • PDF.js (render)   │  • Transformers.js │  • IndexedDB        │
│  • pdf-lib (edit)    │  • WebGPU accel    │  • Cache API        │
│  • Tesseract.js OCR  │  • LangChain.js    │  • Session storage  │
│  • Web Crypto API    │  • Vector search   │  • Blob/File API    │
│  • Canvas API        │  • Local models    │  • Web Workers      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ OPTIONAL (user opt-in only)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Optional)                          │
├─────────────────────────────────────────────────────────────────┤
│  • OpenRouter AI proxy (hide API keys)                          │
│  • LibreOffice conversion (Word/Excel/PPT)                      │
│  • Cloud sync/backup                                            │
│  • Collaborative editing (future)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## First Steps

1. Initialize Turborepo with `bun create turbo@latest`
2. Configure Bun workspaces in `package.json`
3. Create React 19 + Vite app with `bun create vite`
4. Setup shadcn/ui: `bunx shadcn@latest init`
5. Integrate PDF.js for viewing
6. Integrate pdf-lib for manipulation
7. Setup IndexedDB with Dexie.js for storage
8. Create Docker Compose for development (optional backend)

---

## Key Libraries for Local Processing

| Purpose | Library | Size | Notes |
|---------|---------|------|-------|
| PDF Render | PDF.js | ~2MB | Mozilla, battle-tested |
| PDF Edit | pdf-lib | ~300KB | Pure JS, no dependencies |
| OCR | Tesseract.js | ~15MB | WebAssembly, offline |
| AI Inference | Transformers.js | ~50MB+ | WebGPU accelerated |
| Embeddings | @xenova/transformers | ~5MB | For vector search |
| Storage | Dexie.js | ~50KB | IndexedDB wrapper |
| HTML to PDF | html2pdf.js | ~200KB | Client-side |

---

## Document Control

- **Version**: 1.1
- **Created**: November 2024
- **Updated**: November 2024
- **Based on**: PRD.md v1.0
- **Architecture**: Local-First, Privacy by Design
- **Stack**: Bun + Turborepo + React 19 + NestJS (optional) + Docker
