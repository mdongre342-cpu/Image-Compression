# ═══════════════════════════════════════════════════════════════════════════
# Compress & Compare — Dockerfile
# Multi-stage build for optimized production image
# ═══════════════════════════════════════════════════════════════════════════

# Stage 1: Build dependencies
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies required for better-sqlite3
RUN apk add --no-cache \
  python3 \
  make \
  g++ \
  sqlite

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Stage 2: Runtime
FROM node:18-alpine

# Add labels
LABEL maintainer="Compress & Compare Team"
LABEL description="Image compression tool with multiple algorithms"
LABEL version="2.0.0"

WORKDIR /app

# Install only runtime dependencies (sqlite binary)
RUN apk add --no-cache sqlite

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built node_modules from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create data directory with proper permissions
RUN mkdir -p /app/data && \
    chown -R nodejs:nodejs /app

# Switch to nodejs user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "server.js"]
