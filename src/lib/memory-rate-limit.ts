/** Fixed-window counter store — process-local; scale-out needs Redis/WAF. */

type WindowState = { windowStart: number; count: number };

const MAX_ENTRIES_PER_STORE = 4000;

function pruneExpired(map: Map<string, WindowState>, windowMs: number, now: number) {
  if (map.size <= MAX_ENTRIES_PER_STORE) return;
  for (const [k, v] of map) {
    if (now - v.windowStart >= windowMs) map.delete(k);
  }
  if (map.size <= MAX_ENTRIES_PER_STORE) return;
  const overflow = map.size - MAX_ENTRIES_PER_STORE;
  let i = 0;
  for (const k of map.keys()) {
    map.delete(k);
    i++;
    if (i >= overflow) break;
  }
}

const stores = new Map<string, Map<string, WindowState>>();

function bucket(storeName: string): Map<string, WindowState> {
  let m = stores.get(storeName);
  if (!m) {
    m = new Map();
    stores.set(storeName, m);
  }
  return m;
}

export type RateLimitOutcome = { ok: true } | { ok: false; retryAfterSeconds: number };

export function checkRateLimit(params: {
  store: string;
  key: string;
  limit: number;
  windowMs: number;
  /** Inject clock for tests */
  now?: number;
}): RateLimitOutcome {
  const { store, key, limit, windowMs } = params;
  const now = params.now ?? Date.now();
  const map = bucket(store);
  pruneExpired(map, windowMs, now);

  let state = map.get(key);
  if (!state || now - state.windowStart >= windowMs) {
    state = { windowStart: now, count: 0 };
    map.set(key, state);
  }

  if (state.count >= limit) {
    const retryAfterMs = Math.max(0, state.windowStart + windowMs - now);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  state.count++;
  return { ok: true };
}
