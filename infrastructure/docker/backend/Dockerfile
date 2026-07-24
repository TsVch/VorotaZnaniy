# =============================================================================
# KnowledgeVault SaaS — Backend Dockerfile
# Multi-stage build with security best practices
# =============================================================================

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (separate layer for caching)
COPY package.json pnpm-lock.yaml ./
RUN apk add --no-cache python3 make g++ && \
    npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Copy source and build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ ./src/
RUN pnpm build

# ---- Stage 2: Production ----
FROM node:20-alpine AS runner

WORKDIR /app

# Security: Add non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy production dependencies
COPY package.json pnpm-lock.yaml ./
RUN apk add --no-cache python3 make g++ && \
    npm install -g pnpm && \
    pnpm install --frozen-lockfile --prod && \
    rm -rf /root/.npm /root/.cache

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Switch to non-root user
USER nestjs

# Expose application port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start application
CMD ["node", "dist/main"]
