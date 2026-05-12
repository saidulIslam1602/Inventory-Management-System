# Aqila IMS — Inventory & Management System

> Internal management system for **Aqila AS**, an electrical installation company operating across Lofoten, Norway. Tracks inventory, purchase orders, employees, and installation projects.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Database Setup](#database-setup)
5. [Git Workflow](#git-workflow)
6. [Docker](#docker)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Module Overview](#module-overview)
9. [Environment Variables](#environment-variables)
10. [Production Deployment](#production-deployment)

---

## Features

| Module | Capabilities |
|---|---|
| **Dashboard** | KPI cards, low-stock alerts, stock movement chart, real-time overview |
| **Inventory** | Product catalog, stock per location, movement audit log, reorder alerts |
| **Purchase Orders** | Full PO lifecycle (Draft → Received), auto-updates stock on receive |
| **Employees** | Staff profiles, attendance check-in/out, shift scheduling, CSV export |
| **Projects** | Work orders, material reservation, consumption tracking, job cost summary |
| **Reports** | Recharts visualisations, CSV export for all datasets |
| **Settings** | Locations, categories, units, user management (Admin only) |
| **Auth & RBAC** | 4 roles: Admin, Manager, Staff, Viewer — route-level enforcement |

---

## Tech Stack

```
Next.js 15 (App Router + Server Actions)   — Framework
TypeScript 5                                — Type safety
Tailwind CSS v4 + shadcn/ui                — Styling & components
PostgreSQL 16 + Prisma ORM                 — Database
Auth.js v5 (NextAuth)                      — Authentication
Zod + React Hook Form                      — Validation
TanStack Query v5                          — Server state management
Recharts                                   — Data visualisation
Docker + Docker Compose                    — Containerisation
GitHub Actions                             — CI/CD
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 22
- PostgreSQL 16 (or use Docker Compose — see below)
- npm ≥ 10

### 1. Clone the repository

```bash
git clone https://github.com/saidulIslam1602/Inventory-Management-System.git
cd Inventory-Management-System
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your DATABASE_URL, AUTH_SECRET, etc.
```

### 4. Generate AUTH_SECRET

```bash
openssl rand -base64 32
# Paste the output into AUTH_SECRET in .env
```

### 5. Set up the database

```bash
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Run migrations (creates all tables)
npm run db:seed         # Populate with Aqila's 4 locations, sample data
```

### 6. Run the development server

```bash
npm run dev
# Open http://localhost:3000
```

### Demo credentials (after seeding)

| Role | Email | Password |
|---|---|---|
| Admin | admin@aqila.no | Aqila2026! |
| Manager | manager@aqila.no | Aqila2026! |
| Staff | staff@aqila.no | Aqila2026! |

---

## Database Setup

Prisma manages all schema migrations. Migration files live in `prisma/migrations/` and are committed to git.

```bash
# Create a new migration after editing schema.prisma
npm run db:migrate

# Apply migrations in production (no prompt)
npm run db:migrate:deploy

# Open Prisma Studio (DB browser)
npm run db:studio

# Reset and reseed (development only)
npm run db:reset && npm run db:seed
```

---

## Git Workflow

### Branch model

```
main          ← production (protected, CI required to merge)
develop       ← integration branch
feature/*     ← new features
fix/*         ← bug fixes
chore/*       ← maintenance
```

### Commit convention ([Conventional Commits](https://www.conventionalcommits.org/))

```
feat: Add EV charger product category
fix: Correct stock quantity after transfer
chore: Update Prisma to v7.9
docs: Add Docker deployment guide
ci: Add healthcheck to CD workflow
```

Commits are validated by **commitlint** via a Husky `commit-msg` hook.  
Staged files are linted by **lint-staged** via a Husky `pre-commit` hook.

### Semantic versioning

```bash
# Create a release tag
git tag v1.0.0 -m "Initial release"
git push origin v1.0.0
```

---

## Docker

### Local development with Docker Compose

```bash
# Start app + PostgreSQL + Adminer
docker compose -f docker/docker-compose.yml --profile dev up

# App: http://localhost:3000
# Adminer: http://localhost:8080
# DB: localhost:5432
```

### Build the production image

```bash
docker build -t aqila-ims:latest .
```

### Run the production image

```bash
docker run -d \
  --name aqila_ims \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_SECRET="..." \
  -e NEXTAUTH_URL="https://ims.aqila.no" \
  aqila-ims:latest
```

The Dockerfile uses **multi-stage builds** with `output: standalone` — final image is ~200 MB.  
The entrypoint runs `prisma migrate deploy` automatically before starting the server.

---

## CI/CD Pipeline

### Continuous Integration (`.github/workflows/ci.yml`)

Runs on every push and PR:

```
ESLint + Prettier → TypeScript check → Jest tests → next build
```

All jobs must pass before a PR can merge to `main`.

### Continuous Deployment (`.github/workflows/cd.yml`)

Triggers on merge to `main`:

```
Build Docker image → Push to GHCR → SSH to VPS → docker pull + restart → Healthcheck
```

Rolls back automatically if the healthcheck fails.

### Required GitHub Secrets for CD

| Secret | Description |
|---|---|
| `VPS_HOST` | Production server hostname/IP |
| `VPS_USER` | SSH user |
| `VPS_SSH_KEY` | Private SSH key (ed25519) |
| `DATABASE_URL` | Production DB connection string |
| `AUTH_SECRET` | Production Auth.js secret |
| `NEXTAUTH_URL` | Production URL (e.g. `https://ims.aqila.no`) |

---

## Module Overview

### Inventory

- Products are defined globally (catalog); stock is tracked **per location**
- Every quantity change creates an immutable `StockMovement` record
- Low-stock alerts fire when `quantity <= reorderPoint`
- TRANSFER movements deduct from source location and increment destination

### Purchase Orders

Lifecycle: `DRAFT → SUBMITTED → APPROVED → ORDERED → PARTIALLY_RECEIVED → RECEIVED`

- Receiving items triggers `IN` stock movements at the delivery location
- PO status auto-advances to `PARTIALLY_RECEIVED` or `RECEIVED` based on quantities

### Employees

- Each employee has a linked `User` account for system login
- Attendance is recorded daily (upsert by employee + date)
- Hours worked calculated automatically from check-in/check-out times

### Projects

- Materials are **soft-reserved** (increment `stock.reserved`) before consumption
- Consumption triggers an `OUT` movement and decrements both `quantity` and `reserved`
- Job cost summary = `usedQuantity × unitCostAtTime` (price snapshot at reservation time)

---

## Environment Variables

See `.env.example` for the full list. Key variables:

```env
DATABASE_URL     # PostgreSQL connection string
AUTH_SECRET      # NextAuth secret (openssl rand -base64 32)
NEXTAUTH_URL     # App URL (http://localhost:3000 in dev)
NODE_ENV         # development | production
LOG_LEVEL        # info | debug | warn | error
```

---

## Production Deployment

### Option A: Docker on VPS (recommended)

1. Set up PostgreSQL (managed or self-hosted)
2. Add GitHub Secrets (see table above)
3. Push to `main` — CD pipeline handles the rest

### Option B: Vercel + Neon

1. Create a [Neon](https://neon.tech) PostgreSQL database
2. Deploy to Vercel (import the repo)
3. Set environment variables in Vercel dashboard
4. Run `npm run db:migrate:deploy` via Vercel CLI or GitHub Action

### Option C: Supabase + any Node host

Replace `DATABASE_URL` with your Supabase connection string — Prisma works with any PostgreSQL provider.

---

## Licence

Internal use — Aqila AS. All rights reserved.
