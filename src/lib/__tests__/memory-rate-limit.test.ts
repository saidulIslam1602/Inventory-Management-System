import { checkRateLimit } from "@/lib/memory-rate-limit";

describe("checkRateLimit", () => {
  it("allows within limit then blocks until window resets", () => {
    const store = "test_store_" + Math.random().toString(36).slice(2);
    const key = "k1";
    const windowMs = 60_000;
    const t0 = 1_700_000_000_000;

    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit({ store, key, limit: 3, windowMs, now: t0 + i })).toEqual({ ok: true });
    }
    const blocked = checkRateLimit({ store, key, limit: 3, windowMs, now: t0 + 3 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }

    const afterWindow = checkRateLimit({
      store,
      key,
      limit: 3,
      windowMs,
      now: t0 + windowMs + 1,
    });
    expect(afterWindow.ok).toBe(true);
  });
});
