# PDFLover - Claude Code Instructions

## Project Overview

**PDFLover** is a privacy-first, local-first PDF processing platform. All PDF operations run in the browser - no server uploads required.

### Architecture: Local-First

```
BROWSER (100% of core features)
├── PDF Processing: PDF.js, pdf-lib, Tesseract.js
├── AI Chat: Transformers.js + WebGPU
├── Storage: IndexedDB (Dexie.js)
└── State: Zustand

SERVER (Optional, opt-in only)
├── OpenRouter AI proxy
├── LibreOffice conversion (Word/Excel/PPT)
└── Cloud sync/backup
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Monorepo | Turborepo |
| Frontend | React 19, TypeScript, shadcn/ui, TailwindCSS 4, Vite |
| Backend | NestJS (optional), TypeORM, PostgreSQL |
| PDF | PDF.js, pdf-lib, Tesseract.js |
| AI | Transformers.js, WebGPU, OpenRouter |

---

## Project Structure

```
pdf_lover/
├── apps/
│   ├── web/                 # React 19 Frontend (main app)
│   │   ├── src/
│   │   │   ├── components/  # UI components
│   │   │   │   ├── ui/      # shadcn components
│   │   │   │   ├── pdf/     # PDF viewer/editor
│   │   │   │   ├── tools/   # Merge, split, convert panels
│   │   │   │   └── chat/    # AI chat interface
│   │   │   ├── lib/         # PDF & AI utilities
│   │   │   ├── hooks/       # React hooks
│   │   │   └── store/       # Zustand stores
│   │   └── Dockerfile
│   │
│   └── api/                 # NestJS Backend (OPTIONAL)
│       └── src/modules/     # AI proxy, sync, convert
│
├── packages/
│   ├── shared/              # Shared types
│   └── pdf-core/            # PDF processing library
│
├── docker/
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
│
└── docs/
    ├── PRD.md               # Product requirements
    └── IMPLEMENTATION_PLAN.md
```

---

## Development Rules

### Docker First
- Always use Docker for dev, test, and database operations
- Use `docker-compose.dev.yml` for development
- Never install PostgreSQL or Redis locally

### Local-First Architecture
- ALL PDF processing must happen in the browser
- Never send files to server unless user explicitly opts in
- Use Web Workers for CPU-intensive operations
- Store data in IndexedDB, not server database

### Code Style
- Don't use workarounds like adapters or transformers
- Keep components small and focused
- Use Zustand for state management
- Follow shadcn/ui patterns for UI components

---

## Git Commit Rules

### IMPORTANT: No Auto-Generated Text
- **NEVER include "Generated with Claude Code" in commit messages**
- **NEVER include "Co-Authored-By: Claude" in commits**
- Write commit messages as if a human developer wrote them

### Commit Format
```
type(scope): subject

body (optional)
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

### Examples
```bash
feat(pdf): add merge functionality with drag-and-drop

fix(viewer): resolve zoom controls not working on mobile

docs: update API documentation for convert module
```

---

## Commands

### Development
```bash
bun install              # Install dependencies
bun dev                  # Start dev server
bun build                # Build for production
bun test                 # Run tests
```

### Docker
```bash
docker compose -f docker/docker-compose.dev.yml up    # Start dev environment
docker compose -f docker/docker-compose.yml up        # Start production
```

---

# 🎛️ Implementation Workflow System

## How to Use `/implement`

The `/implement` command executes a complete 10-step implementation workflow with security and performance validation.

### Usage
```
/implement [feature description]
```

### Example
```
/implement Add PDF merge functionality with drag-and-drop reordering
```

### Workflow Steps
1. **Analyze** - Understand requirements and existing code
2. **Plan** - Create implementation strategy
3. **Implement** - Write the code
4. **Test** - Create and run tests
5. **Review** - Code quality check
6. **Security** - Security validation
7. **Performance** - Performance check
8. **Document** - Update documentation
9. **Commit** - Create atomic commits
10. **Verify** - Final validation

---

## 🎯 Adaptive Tier Selection

All workflows support intelligent tier selection based on complexity:

### Tier 1 (Simple)
- ≤3 files affected
- Single service/component
- <20 tests
- Low risk
- Duration: <30 minutes

**Agents**: `code-implementer` → `code-reviewer`

### Tier 2 (Standard)
- 4-10 files affected
- 2-3 services/components
- 20-100 tests
- Medium risk
- Duration: 30-120 minutes

**Agents**: `solution-architect` → `code-implementer` → `code-reviewer` → `test-specialist`

### Tier 3 (Complex)
- >10 files affected
- >3 services/components
- >100 tests
- High risk
- Duration: >120 minutes

**Agents**: All specialized agents with comprehensive validation

### Manual Override
```bash
# Force Tier 1
"Override to Tier 1 Simple Workflow"

# Force Tier 2
"Override to Tier 2 Standard Workflow"

# Force Tier 3
"Override to Tier 3 Complex Workflow"
```

---

## 🛡️ Safety & Recovery

### Parallel Agent Conflict Detection

Before executing parallel agents, check for:
1. **File Overlap**: Do agents modify same files?
2. **Dependency Chain**: Does Agent B depend on Agent A?
3. **Shared Resources**: Same databases/services?
4. **Integration Points**: Will changes conflict?

### Failure Recovery Options
1. **RETRY**: Re-execute with adjusted parameters
2. **ROLLBACK**: Undo changes, restart from checkpoint
3. **SKIP**: Mark as non-critical, continue
4. **ESCALATE**: Switch to higher tier workflow

---

## 📊 Integration Patterns

### Handoff Pattern (Sequential)
```
Agent A completes → Agent B continues → Agent C validates
```
Use when tasks have strict dependencies.

### Parallel Merge Pattern
```
Agents run simultaneously → Merge results → Validate
```
Use when tasks are completely independent.

---

## 🚀 Available Agents

### Core Implementation Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `solution-architect` | System design, architecture decisions, ADRs | Planning features, designing APIs, major refactors |
| `code-implementer` | Write production code, implement features | Building features, fixing bugs, refactoring |
| `code-reviewer` | Quality review, best practices validation | After implementation, before commits |
| `test-specialist` | Create comprehensive test suites | After features complete, improving coverage |
| `test-runner` | Execute tests, report results | Validation phases, CI checks |

### Security & Performance Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `security-auditor` | Vulnerability assessment, OWASP compliance | Security reviews, before deployment |
| `performance-optimizer` | Bottleneck analysis, optimization | Performance issues, scaling prep |

### Documentation & Deployment Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `docs-sync-engineer` | Sync docs with code changes | After features, API changes |
| `atomic-commit-assistant` | Create atomic commits | During /commit workflow |
| `progress-analyst` | Analyze changes, generate reports | Status checks, commit prep |
| `deployment-orchestrator` | Manage deployments, rollbacks | Production deployments |

### UI & Design Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `ui-designer` | UI/UX design, components, accessibility | Design system, new UI features |
| `api-contract-designer` | API design, OpenAPI specs | New APIs, versioning |

### Specialized Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `database-migration-specialist` | Schema changes, migrations | Database changes |
| `dependency-manager` | Dependency updates, vulnerability scanning | Package updates |
| `monitoring-configurator` | Observability, alerting setup | Production monitoring |
| `incident-responder` | Incident management, post-mortems | Production issues |

### Agent Usage Examples

```bash
# Architecture planning
Task: solution-architect
Prompt: "Design the PDF merge feature architecture..."

# Implementation
Task: code-implementer
Prompt: "Implement the merge functionality in apps/web/src/lib/pdf/merge.ts..."

# Code review
Task: code-reviewer
Prompt: "Review the PDF merge implementation for quality and security..."

# Testing
Task: test-specialist
Prompt: "Create comprehensive tests for the merge feature..."

# Security check
Task: security-auditor
Prompt: "Audit the PDF merge feature for security vulnerabilities..."
```

### Parallel Agent Execution

**Safe to run in parallel:**
- Different files/components
- Independent features
- Separate services

**Must run sequentially:**
- Same files
- Dependent features
- Shared state

```bash
# SAFE: Parallel execution (different files)
Task: code-implementer (Agent 1) → apps/web/src/lib/pdf/merge.ts
Task: code-implementer (Agent 2) → apps/web/src/lib/pdf/split.ts

# UNSAFE: Must be sequential (same file)
Task: code-implementer → apps/web/src/lib/pdf/utils.ts
Task: code-reviewer → apps/web/src/lib/pdf/utils.ts  # Wait for implementer
```

---

## 📋 Other Workflow Commands

| Command | Description |
|---------|-------------|
| `/test-resolution` | Systematic test failure resolution |
| `/commit` | Atomic commits with conventional format |
| `/deploy` | Deployment with validation and rollback |
| `/security-audit` | Security assessment and compliance |
| `/specify` | Create feature specifications |
| `/tasks` | Generate actionable task list |
| `/plan` | Implementation planning |

---

## 🎯 Feature Development Pipeline

For complete feature development:

```
1. /specify     → Define requirements
2. /plan        → Create implementation plan
3. /tasks       → Generate task list
4. /implement   → Build the feature
5. /commit      → Create commits
6. /deploy      → Deploy to environment
```

---

## Quick Reference

### Start Implementation
```
/implement [description]
```

### Check Status
```
/status-report
```

### Create Commits
```
/commit
```

### Run Tests
```
bun test
```

### After Workflow Completion
- Review changes with `/status-report`
- Create commits with `/commit`
- Continue with next task
