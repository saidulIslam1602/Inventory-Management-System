# Vendor DPA & subprocessors — Aqila IMS

This repository processes **business operational data** (inventory, HR-ish attendance, identities for login). **Legal advice belongs with counsel** — use this as an internal worksheet before signing vendor agreements.

**Related:** [`ropa-lawful-basis-template.md`](./ropa-lawful-basis-template.md), [`privacy-retention-and-erasure.md`](./privacy-retention-and-erasure.md), [`go-live-execution-checklist.md`](./go-live-execution-checklist.md) § H.

---

## 1. Data Processing Agreement (DPA)

Before production, confirm with each **processor** (where EU/UK GDPR applies):

| Topic         | Question for vendor                                                       |
| ------------- | ------------------------------------------------------------------------- |
| Roles         | Are they **processor** under your instructions or independent controller? |
| Purpose       | Hosting, DB, email relay, analytics — documented purposes only.           |
| Subprocessors | Notification requirement / objection rights per contract.                 |
| Transfers     | SCCs / UK IDTA / adequacy if data leaves EEA/UK.                          |
| Security      | Encryption in transit/at rest; breach notification SLA.                   |
| Deletion      | Delete or return data on exit; backup retention alignment.                |
| Audits        | SOC2 / ISO reports available?                                             |
| DPIA trigger  | Does scale/sensitivity require a DPIA under local law?                    |

---

## 2. Typical subprocessors for this stack

Fill in **your** vendors (examples only):

| Function                | Example vendors to evaluate                          | Data touched                         |
| ----------------------- | ---------------------------------------------------- | ------------------------------------ |
| Application host        | Azure Container Apps, AWS App Runner, Vercel, Fly.io | HTTP payloads, logs                  |
| Database                | Neon, Supabase, RDS, Azure Postgres                  | All app DB rows                      |
| SMTP                    | SendGrid, SES, Microsoft 365 relay                   | Email addresses, message metadata    |
| Secrets CI              | GitHub Actions secret store                          | Connection strings in workflows      |
| Distributed rate limits | Upstash Redis                                        | Keys derived from client identifiers |
| Observability           | Grafana Cloud, Honeycomb, Datadog, Azure Monitor     | Traces, possibly URLs                |

---

## 3. DPAs to prioritize before go-live

- [ ] Database provider (contains majority of personal data).
- [ ] Application host / CDN (logs may contain IPs, URLs).
- [ ] Corporate SMTP / transactional mail.
- [ ] Any OpenTelemetry / logging SaaS receiving traces.

---

## 4. Sign-off

Record **owner**, **date**, and **document links** (contract workspace / ticket IDs) in your internal wiki — not in git.
