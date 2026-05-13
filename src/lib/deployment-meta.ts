/**
 * Deployment revision for health checks and log correlation (no secrets).
 * Set one of the env vars below in CI/CD or the container runtime.
 */

export function getDeploymentRevision(): string | undefined {
  const candidates = [
    process.env.APP_VERSION,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GITHUB_SHA,
    process.env.K_REVISION,
    process.env.SOURCE_VERSION,
  ];
  for (const raw of candidates) {
    const t = raw?.trim();
    if (t && t.length > 0) return t.length <= 64 ? t : `${t.slice(0, 61)}...`;
  }
  return undefined;
}
