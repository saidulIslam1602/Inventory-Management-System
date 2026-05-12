#!/bin/sh
# ──────────────────────────────────────────────────────────────────────────────
# Aqila IMS — Docker entrypoint
# Runs Prisma migrations before starting the Next.js server.
# This ensures the DB schema is always up to date on container start.
# ──────────────────────────────────────────────────────────────────────────────

set -e

echo "🔄 Syncing database schema..."
# Resolve `prisma/config` (and peers) from the CLI install under /prisma-tools.
export NODE_PATH="/prisma-tools/node_modules:/app/node_modules${NODE_PATH:+:$NODE_PATH}"
node /prisma-tools/node_modules/prisma/build/index.js db push

echo "🚀 Starting Aqila IMS..."
exec node server.js
