#!/bin/sh
# ──────────────────────────────────────────────────────────────────────────────
# Aqila IMS — Docker entrypoint
# Runs Prisma migrations before starting the Next.js server.
# This ensures the DB schema is always up to date on container start.
# ──────────────────────────────────────────────────────────────────────────────

set -e

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "🚀 Starting Aqila IMS..."
exec node server.js
