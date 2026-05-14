# Application observability — Aqila IMS

Tracker **7** (production readiness). This doc ties **health checks**, **structured logs**, and **SLO thinking** together. In-repo **OpenTelemetry** bootstrap ([`node-otel.ts`](../src/lib/node-otel.ts) + [`instrumentation.ts`](../src/instrumentation.ts)) complements vendor **APM** agents — enable with **`OTEL_ENABLED=true`** and an OTLP endpoint.

**Related:** [`logging-and-correlation.md`](./logging-and-correlation.md), [`database-performance.md`](./database-performance.md), [`secrets-and-config.md`](./secrets-and-config.md) (`OTEL_*`), [`GET /api/health`](../src/app/api/health/route.ts), [`deployment-meta.ts`](../src/lib/deployment-meta.ts).

---

## Signals you already have

| Signal                            | Where                                                                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Liveness + DB**                 | `GET /api/health` — `SELECT 1`; JSON includes optional **`revision`** when **`APP_VERSION`** / **`VERCEL_GIT_COMMIT_SHA`** / **`GITHUB_SHA`** / **`K_REVISION`** / **`SOURCE_VERSION`** is set |
| **Request correlation**           | **`x-request-id`** — [`logging-and-correlation.md`](./logging-and-correlation.md)                                                                                                              |
| **Structured logs**               | Pino JSON → stdout — ship to your log platform                                                                                                                                                 |
| **Cron outcome**                  | `GET /api/cron/digest-email` JSON body — alert on non-2xx or scheduler misses                                                                                                                  |
| **Distributed traces (optional)** | **`OTEL_ENABLED=true`** — OTLP HTTP exporter ([`node-otel.ts`](../src/lib/node-otel.ts))                                                                                                       |

---

## SLO starter template (edit for your org)

Copy into your internal wiki or incident docs.

| Objective                             | Target                                  | Measurement idea                                                       |
| ------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| **Availability**                      | e.g. 99.5% monthly                      | Synthetic probe `GET /api/health` every 1–5 min                        |
| **Latency (authenticated dashboard)** | e.g. p95 < 3 s                          | Reverse proxy / CDN access logs or APM                                 |
| **Error rate**                        | e.g. fewer than 1% of responses are 5xx | LB or app logs filtered by status                                      |
| **Cron reliability**                  | e.g. 100% daily success                 | Scheduler checks HTTP 200 + optional JSON field                        |
| **Database**                          | Recover within RTO                      | [`database-backups-and-restore.md`](./database-backups-and-restore.md) |

**Error budget:** If availability SLO is 99.5%, budget ≈ 3.65 h downtime/month — use it to prioritize incidents vs features.

---

## When to add APM or OpenTelemetry

Add tracing/metrics when:

- You need **per-route** latency breakdown (Server Actions vs Prisma vs external SMTP).
- You’re tuning **cold start** or **DB pool** contention.

Practical paths (vendor-neutral):

1. **Host-based agent** — Datadog / New Relic / Azure Monitor Application Insights **Node.js** instrumentation alongside the Node process (often zero code beyond env).
2. **OpenTelemetry SDK** — OTLP HTTP exporter in [`node-otel.ts`](../src/lib/node-otel.ts): set **`OTEL_ENABLED=true`**, **`OTEL_EXPORTER_OTLP_ENDPOINT`** (vendor HTTPS **`…/v1/traces`**), and optional **`OTEL_EXPORTER_OTLP_HEADERS`** for API keys; [`instrumentation.ts`](../src/instrumentation.ts) registers on boot.
3. **Edge + Node split** — middleware (`proxy.ts`) runs on Edge; heavy instrumentation usually targets the **Node** server — instrument handlers and Prisma on Node only.

### Local collector (debug only)

From repo root:

```bash
docker run --rm -p 4318:4318 -p 4317:4317 \
  -v "$PWD/docker/otel-collector-config.yaml:/etc/otelcol/config.yaml:ro" \
  otel/opentelemetry-collector:latest \
  --config /etc/otelcol/config.yaml
```

Then run the app with **`OTEL_ENABLED=true`** and **`OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces`**. Spans print via the collector’s **`debug`** exporter.

### Production

Use your vendor’s **HTTPS** OTLP ingest URL. **`validate-production-env`** requires an explicit endpoint and rejects plaintext **`http://`** except for **`localhost` / `127.0.0.1`** when **`NODE_ENV=production`**.

Do **not** duplicate: pick logs **or** traces for the same datum unless you have a query story.

---

## Dashboard checklist

- [ ] Uptime / health status panel (`/api/health`)
- [ ] 5xx rate + latency from LB or APM
- [ ] Log volume + error keyword alerts (`error`, `fatal`, `audit_event persist failed`)
- [ ] Cron last-success timestamp
- [ ] Postgres CPU / connections / disk (provider metrics)

---

## Deployment correlation

Set **`APP_VERSION`** (e.g. git tag `v1.2.3` or short SHA) in production — surfaced on **`/api/health`** so load balancers and on-call can confirm which build is live.

Common CI env vars auto-detected when set: **`VERCEL_GIT_COMMIT_SHA`**, **`GITHUB_SHA`**, **`K_REVISION`** (Cloud Run), **`SOURCE_VERSION`** (some PaaS).
