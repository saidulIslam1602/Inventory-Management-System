#!/usr/bin/env bash
# GitHub rejects HTTPS pushes that modify Actions workflows unless your credential has the "workflow" scope.
# Easiest fix: use SSH for origin + register this machine's public key once.

set -euo pipefail

echo "=== 1) Add this SSH public key to GitHub ==="
echo "    https://github.com/settings/ssh/new"
echo ""
cat ~/.ssh/id_ed25519_github.pub 2>/dev/null || {
  echo "Missing ~/.ssh/id_ed25519_github.pub — generating..."
  ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -N "" -C "aqila-ims-push-$(hostname)"
  cat ~/.ssh/id_ed25519_github.pub
}
echo ""
echo "=== 2) Ensure origin uses SSH (not HTTPS) ==="
echo '    git remote set-url origin git@github.com:saidulIslam1602/Inventory-Management-System.git'
echo ""
echo "=== 3) Push ==="
echo "    git push origin main"
echo ""
echo "Alternative (stay on HTTPS): refresh gh token with workflow scope — complete browser/device flow:"
echo "    gh auth refresh -h github.com -s workflow"
