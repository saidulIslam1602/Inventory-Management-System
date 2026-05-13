/**
 * Optional distributed rate limiting via Upstash Redis (REST).
 * When `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are unset, callers fall back to
 * process-local counters (`memory-rate-limit.ts`).
 *
 * Upstash modules load via **dynamic `import()`** only when configured — keeps Jest (`memory`-only)
 * from pulling ESM-only transitive deps at parse time.
 */

import {
  checkRateLimit as memoryCheckRateLimit,
  type RateLimitOutcome,
} from "@/lib/memory-rate-limit";

/** Narrow surface used after dynamic import (avoids static `@upstash/*` in the module graph). */
type UpstashLimiter = {
  limit: (identifier: string) => Promise<{ success: boolean; reset: number }>;
};

function upstashRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

/** Ratelimit sliding-window duration label understood by Upstash. */
function slidingWindowLabel(windowMs: number): string {
  if (windowMs >= 60_000 && windowMs % 60_000 === 0) {
    return `${windowMs / 60_000} m`;
  }
  if (windowMs >= 1000 && windowMs % 1000 === 0) {
    return `${windowMs / 1000} s`;
  }
  return `${Math.max(1, Math.ceil(windowMs / 60_000))} m`;
}

const limiterCache = new Map<string, UpstashLimiter>();

async function getDistributedLimiter(
  store: string,
  limit: number,
  windowMs: number
): Promise<UpstashLimiter | null> {
  if (!upstashRedisConfigured()) return null;

  const duration = slidingWindowLabel(windowMs);
  const cacheKey = `${store}:${limit}:${duration}`;
  let lim = limiterCache.get(cacheKey);
  if (!lim) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    lim = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, duration as never),
      prefix: `aqila:rl:v1:${store}`,
      analytics: false,
    }) as unknown as UpstashLimiter;
    limiterCache.set(cacheKey, lim);
  }
  return lim;
}

export async function consumeAuthRateLimit(params: {
  store: string;
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitOutcome> {
  const lim = await getDistributedLimiter(params.store, params.limit, params.windowMs);
  if (!lim) {
    return memoryCheckRateLimit(params);
  }

  const { success, reset } = await lim.limit(params.key);
  if (success) return { ok: true };

  const retryAfterMs = Math.max(0, reset - Date.now());
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
}
