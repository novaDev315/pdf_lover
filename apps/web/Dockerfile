# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/pdf-core/package.json ./packages/pdf-core/

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/pdf-core/node_modules ./packages/pdf-core/node_modules

# Copy source code
COPY . .

# Build the application
ENV NODE_ENV=production
RUN pnpm --filter web build

# Stage 3: Production
FROM nginx:alpine AS production

# Copy nginx configuration
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder stage
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Create health check endpoint
RUN mkdir -p /usr/share/nginx/html && \
    echo '{"status":"ok"}' > /usr/share/nginx/html/health

# Add non-root user for security
RUN addgroup -g 1001 -S pdflover && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G pdflover pdflover && \
    chown -R pdflover:pdflover /var/cache/nginx && \
    chown -R pdflover:pdflover /var/log/nginx && \
    chown -R pdflover:pdflover /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R pdflover:pdflover /var/run/nginx.pid && \
    chown -R pdflover:pdflover /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
