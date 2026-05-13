# Logging & request correlation — Aqila IMS

Tracker **6** (production readiness). Goals: **structured logs** in Node.js and a stable **`x-request-id`** across middleware → handlers.

---

## Request correlation (`x-request-id`)

[`src/proxy.ts`](../src/proxy.ts) (Edge middleware):

- Accepts incoming **`x-request-id`** from your load balancer or generates **`crypto.randomUUID()`**.
- Applies to **all matched routes**, including **`/api/*`** (auth RBAC still runs only on non-API paths — API routes do **not** go through `withAuth`).
- Forwards the header on **`NextResponse.next({ request: { headers } })`** so Server Components, Route Handlers, and Server Actions can read it via `headers()` from `next/headers`.
- Echoes the same value on the **response** header for browser / LB tracing.

In Route Handlers or Server Actions:

```typescript
import { requestLogger } from "@/lib/request-log";

export async function GET() {
  const log = await requestLogger();
  log.info({ stage: "start" }, "processing export");
  // ...
}
```

---

## Structured logging (Pino)

[`src/lib/logger.ts`](../src/lib/logger.ts) exports a shared **`logger`**:

| Environment               | Behaviour                                                           |
| ------------------------- | ------------------------------------------------------------------- |
| **`NODE_ENV=production`** | JSON lines to stdout; level from **`LOG_LEVEL`** (default `info`).  |
| **Development**           | **`pino-pretty`** for human-readable output; default level `debug`. |
| **`NODE_ENV=test`**       | JSON only (no pretty transport) so Jest stays stable.               |

Ship stdout to your aggregator (Datadog, Loki, Azure Monitor, Cloud Logging, etc.) — no in-repo vendor coupling.

**See also:** [`application-observability.md`](./application-observability.md) — SLOs, dashboards, optional APM/OpenTelemetry.

---

## Migrating from `console`

Prefer **`logger`** / **`requestLogger()`** for anything operational (errors after catches, export flows, cron summaries). Keep **`console`** only where tooling expects it (e.g. some CLI scripts).

---

## Related

- Audit persistence failures log via [`record-event.ts`](../src/lib/audit/record-event.ts).
- Env: **`LOG_LEVEL`** in [`.env.example`](../.env.example).
