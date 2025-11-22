# PDFLover Documentation

> Privacy-first, local-first PDF processing platform

## Quick Links

| Document | Description |
|----------|-------------|
| [PRD.md](./PRD.md) | Product Requirements Document |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Technical implementation plan |

## Documentation Structure

```
docs/
├── README.md                 # This file - documentation index
├── PRD.md                    # Product requirements
├── IMPLEMENTATION_PLAN.md    # Implementation plan
└── (future docs)
    ├── ARCHITECTURE.md       # System architecture
    ├── API_REFERENCE.md      # API documentation
    ├── DEVELOPMENT_GUIDE.md  # Development workflow
    └── DEPLOYMENT.md         # Deployment guide
```

## Project Overview

PDFLover is a **100% free, privacy-focused** PDF processing platform where:

- All PDF operations run **in the browser** (no server uploads)
- AI chat uses **local WebGPU models** by default
- Backend is **optional** (only for cloud AI proxy and proprietary format conversion)
- No account required, no tracking, no ads

## Architecture

```
BROWSER (100% of core features)
├── PDF Processing: PDF.js, pdf-lib, Tesseract.js
├── AI Chat: Transformers.js + WebGPU
├── Storage: IndexedDB (Dexie.js)
└── State: Zustand

SERVER (Optional, opt-in only)
├── OpenRouter AI proxy
├── LibreOffice conversion
└── Cloud sync/backup
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Monorepo | Turborepo |
| Frontend | React 19, TypeScript, shadcn/ui, TailwindCSS 4 |
| Backend | NestJS (optional) |
| PDF | PDF.js, pdf-lib, Tesseract.js |
| AI | Transformers.js, WebGPU, OpenRouter |

## Getting Started

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the complete implementation roadmap.

---

*Last updated: November 2024*
