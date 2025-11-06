# syntax = docker/dockerfile:1

# Use Node.js 22 Alpine image
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build TypeScript
RUN npm run build

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 wsserver

# Copy built application
COPY --from=builder --chown=wsserver:nodejs /app/dist ./dist
COPY --from=builder --chown=wsserver:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=wsserver:nodejs /app/package.json ./package.json

USER wsserver

EXPOSE 8080

ENV PORT=8080
ENV HOST=0.0.0.0

# Start the server
CMD ["node", "dist/index.js"]
