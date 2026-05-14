#!/usr/bin/env bash
# Push `main` after granting GitHub CLI the `workflow` scope (required when
# `.github/workflows/**` changed). Deploy keys alone cannot update workflow files.
set -euo pipefail
cd "$(dirname "$0")/.."

echo ">>> Refreshing gh auth — complete browser/device steps when prompted..."
gh auth refresh -h github.com -s workflow

echo ">>> Using HTTPS origin so gh's credential helper supplies the updated token..."
git remote set-url origin https://github.com/saidulIslam1602/Inventory-Management-System.git

echo ">>> Pushing main..."
git push origin main

echo ">>> Done."
