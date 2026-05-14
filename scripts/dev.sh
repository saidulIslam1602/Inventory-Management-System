#!/usr/bin/env bash
# Start Next.js dev server with Node from .nvmrc when nvm is available.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Cursor/IDE sometimes sets npm_config_prefix and breaks nvm — clear it for this subshell.
unset npm_config_prefix

if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  . "$NVM_DIR/nvm.sh"
  nvm use
fi

PORT="${PORT:-3010}"
echo ""
echo "  Aqila IMS — open in your browser:"
echo "    http://localhost:${PORT}"
echo ""
echo "  (This project uses port ${PORT}, not 3000. Keep NEXTAUTH_URL in .env on the same host, e.g. http://localhost:${PORT})"
echo ""

exec "$ROOT/node_modules/.bin/next" dev --hostname 0.0.0.0 --port "${PORT}"
