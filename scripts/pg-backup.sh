#!/usr/bin/env bash
set -euo pipefail

# Logical PostgreSQL backup (custom format). Requires `pg_dump` on PATH.
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/pg-backup.sh [path/to/output.dump]
#
# Default output: ./backups/aqila_ims-<timestamp>.dump (directory gitignored)
#
# Docs: docs/database-backups-and-restore.md

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"

stamp="$(date +%Y%m%d-%H%M%S)"
default_out="$(pwd)/backups/aqila_ims-${stamp}.dump"
out="${1:-$default_out}"

mkdir -p "$(dirname "$out")"

pg_dump "$DATABASE_URL" --format=custom --no-owner --file="$out"

echo "Backup written: $out"
