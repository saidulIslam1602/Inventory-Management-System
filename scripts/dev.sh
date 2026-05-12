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

exec "$ROOT/node_modules/.bin/next" dev --port 3010
