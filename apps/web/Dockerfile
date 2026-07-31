FROM oven/bun:1.3.13-debian AS dependencies
WORKDIR /app

COPY package.json bun.lock bunfig.toml turbo.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/pdf-core/package.json packages/pdf-core/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS builder
ARG VITE_API_BASE_URL=https://api.pdflover.lab.novadev.tech
ARG VITE_BUILD_SHA=unknown
ARG VITE_BUILD_TIME=unknown
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_BUILD_SHA=${VITE_BUILD_SHA}
ENV VITE_BUILD_TIME=${VITE_BUILD_TIME}
COPY apps/web apps/web
COPY packages/pdf-core packages/pdf-core
COPY packages/shared packages/shared
RUN bunx tsc --build packages/shared/tsconfig.json packages/pdf-core/tsconfig.json --force \
    && test -f packages/shared/dist/index.d.ts \
    && test -f packages/pdf-core/dist/index.d.ts
RUN bun run --filter @pdflover/web build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS production
COPY apps/web/nginx.conf /etc/nginx/nginx.conf
COPY apps/web/nginx-security-headers.conf /etc/nginx/pdflover-security-headers.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
RUN nginx -t \
    && find /usr/share/nginx/html/assets -type f -name '*.mjs' -print -quit | grep -q .

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
