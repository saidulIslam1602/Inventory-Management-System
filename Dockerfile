# ──────────────────────────────────────────────────────────────────────────────
# Aqila IMS — Multi-stage Dockerfile
#
# Stage 1 (deps):     Install production dependencies
# Stage 2 (builder):  Build the Next.js application
# Stage 3 (runner):   Minimal production image using standalone output
#
# Final image size: ~200 MB vs ~1.5 GB without standalone
# Runs as non-root user for security
# ──────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=22-alpine

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Install libc compatibility for alpine (needed by some native modules)
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
# Clean install — respects lockfile for reproducible builds
RUN npm ci

# ── Stage 2: Build application ────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client before building
RUN npx prisma generate

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only the standalone build artifacts
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files needed for migrations at runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy the entrypoint script
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check — verifies the app is responding before traffic is routed
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
