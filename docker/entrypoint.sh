#!/bin/sh
# ──────────────────────────────────────────────────────────────────────────────
# Aqila IMS — Docker entrypoint
# Applies versioned Prisma migrations before starting the Next.js server.
# Uses `migrate deploy` (not `db push`) so production matches prisma/migrations/.
# Reads datasource URL from prisma.config.ts — prefers DATABASE_DIRECT_URL when set (pooler setups).
#
# Existing DB that already matches schema but has no/wrong migration history:
# see AGENTS.md → Prisma migrations (baseline / `migrate resolve`).
# ──────────────────────────────────────────────────────────────────────────────

set -e

echo "🔄 Applying database migrations (prisma migrate deploy)..."
# Resolve `prisma/config` (and peers) from the CLI install under /prisma-tools.
export NODE_PATH="/prisma-tools/node_modules:/app/node_modules${NODE_PATH:+:$NODE_PATH}"
NODE_OPTIONS=--experimental-require-module \
  node /prisma-tools/node_modules/prisma/build/index.js migrate deploy

echo "🚀 Starting Aqila IMS..."
exec node server.js
