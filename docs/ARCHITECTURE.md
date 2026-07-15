# PDFLover Architecture

PDFLover is a local-first document workspace with a deliberately small server
boundary. Browser-safe transformations and the persistent document library stay
in the web app. Operations that require system PDF engines, cryptographic
material, expensive conversion, or a cloud credential run as temporary backend
jobs only after explicit upload consent.

## Runtime ownership

- `apps/web` owns the React UI, browser-native PDF work, IndexedDB persistence,
  offline behavior, and the typed API client.
- `apps/api` owns liveness/readiness, capability reporting, bounded temporary
  jobs, engine subprocess isolation, artifact cleanup, and the OpenRouter proxy.
- `packages/pdf-core` owns browser-native PDF operation implementations.
- `packages/shared` owns serializable operation, capability, job, artifact, and
  error contracts shared by the two applications.
- Homelab owns image build, test, publish, deployment, routes, health, logs, and
  rollback through `homelab.yaml`.
- NexOS owns environment and secret resolution through `.nexos/env.yaml`; secret
  values are never committed.

The backend engine image provides qpdf encryption/decryption, sanitized raster
redaction, pyHanko PKCS#12 signing with post-signature integrity validation,
Tesseract searchable OCR, best-effort OOXML conversion, and raster-based lossy
compression. Capability probes are runtime truth; the UI does not manufacture
success when an engine is missing.

## Data lifecycle

Original documents and saved versions belong in browser IndexedDB. Backend job
inputs and outputs are temporary and must remain inside the configured job root.
They are deleted on cancellation, explicit deletion, completed download policy,
or TTL expiry. The backend does not provide a permanent server-side library.

Jobs follow this lifecycle:

```text
queued -> running -> succeeded | failed | cancelled -> expired
```

An operation may report success only after its output passes the operation's
artifact validation. A missing executable, unavailable engine, invalid input,
or upstream failure is returned as a typed error; the API does not substitute
the input unchanged or a fabricated artifact.

## Deployment

Production is two normal Homelab image applications, not a native service and
not a Docker Compose stack:

- `pdflover-backend`: Bun API on port 8000, health at
  `/api/v1/health/ready`, route `api.pdflover.lab.novadev.tech`. Readiness
  requires every document engine advertised by this release.
- `pdflover-frontend`: nginx static SPA on port 8080, health at `/health`,
  route `web.pdflover.lab.novadev.tech`.

The checked-in Dockerfiles are image build inputs for Homelab. A live build,
push, deploy, route sync, or secret mutation requires its own operator approval.
