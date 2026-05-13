#!/usr/bin/env bash
# GitHub rejects HTTPS pushes that modify Actions workflows unless the credential has the "workflow" scope.
# SSH fix: add this machine's key to your **GitHub account** (Settings → SSH keys), NOT only as a repo deploy key.
# Deploy keys cannot update .github/workflows/.

set -euo pipefail

echo "=== 1) Add this SSH public key to your ACCOUNT ==="
echo "    https://github.com/settings/ssh/new"
echo "    (Do not rely on a repository deploy key for workflow updates.)"
echo ""
cat ~/.ssh/id_ed25519_github.pub 2>/dev/null || {
  echo "Missing ~/.ssh/id_ed25519_github.pub — generating..."
  ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -N "" -C "aqila-ims-push-$(hostname)"
  cat ~/.ssh/id_ed25519_github.pub
}
echo ""
echo "=== 2) Ensure origin uses SSH ==="
echo '    git remote set-url origin git@github.com:saidulIslam1602/Inventory-Management-System.git'
echo ""
echo "=== 3) Push ==="
echo "    git push origin main"
echo ""
echo "Alternative — HTTPS + workflow scope on your gh token:"
echo "    ./scripts/push-main-with-workflow-scope.sh"
