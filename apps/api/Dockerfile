FROM oven/bun:1.3.13-debian AS dependencies
WORKDIR /app

COPY package.json bun.lock bunfig.toml turbo.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/pdf-core/package.json packages/pdf-core/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS builder
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN bunx tsc --build packages/shared/tsconfig.json --force \
    && test -f packages/shared/dist/index.d.ts
RUN bunx tsc --project apps/api/tsconfig.json

FROM oven/bun:1.3.13-debian AS production
WORKDIR /app

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends \
      ca-certificates \
      curl \
      fonts-dejavu-core \
      poppler-utils \
      python3 \
      python3-docx \
      python3-openpyxl \
      python3-pil \
      python3-pip \
      qpdf \
      tesseract-ocr \
      tesseract-ocr-ara \
      tesseract-ocr-chi-sim \
      tesseract-ocr-chi-tra \
      tesseract-ocr-deu \
      tesseract-ocr-eng \
      tesseract-ocr-fra \
      tesseract-ocr-hin \
      tesseract-ocr-ita \
      tesseract-ocr-jpn \
      tesseract-ocr-kor \
      tesseract-ocr-nld \
      tesseract-ocr-pol \
      tesseract-ocr-por \
      tesseract-ocr-rus \
      tesseract-ocr-spa \
    && python3 -m pip install --break-system-packages --no-cache-dir python-pptx==1.0.2 pyHanko==0.35.2 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=bun:bun /app/node_modules node_modules
COPY --from=builder --chown=bun:bun /app/apps/api/node_modules apps/api/node_modules
COPY --from=builder --chown=bun:bun /app/apps/api/package.json apps/api/package.json
COPY --from=builder --chown=bun:bun /app/apps/api/dist apps/api/dist
COPY --from=builder --chown=bun:bun /app/apps/api/scripts apps/api/scripts
COPY --from=builder --chown=bun:bun /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder --chown=bun:bun /app/packages/shared/dist packages/shared/dist

RUN cd apps/api \
    && bun -e "await import('@fastify/cors'); await import('@fastify/multipart'); await import('fastify')"

RUN mkdir -p /tmp/pdflover-jobs && chown bun:bun /tmp/pdflover-jobs
USER bun

ENV APP_ENV=production \
    BACKEND_HOST=0.0.0.0 \
    BACKEND_PORT=8000 \
    JOB_TEMP_ROOT=/tmp/pdflover-jobs

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:8000/api/v1/health/ready >/dev/null || exit 1

CMD ["bun", "apps/api/dist/main.js"]
