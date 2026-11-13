# Alpha Recover

Frontend for **Alpha Recover**: online data recovery training and services from Ahmedabad.

**Project folder:** `Alpha Recover`  
**Live site (temporary):** https://recova-sand.vercel.app  
**Vercel project:** `recova` (hosting slug; app brand is Alpha Recover). Production hosting is undecided; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §3.

## Getting started

Requirements: Node.js 24 and npm.

```bash
cd "Alpha Recover"
npm install
npm run dev
```

Open http://localhost:5173

The frontend needs no environment variables.

### Backend API (optional for frontend work)

Requirements: Docker (Docker Desktop or OrbStack) for the local MySQL.

```bash
npm run db:up                 # MySQL 8.4 in Docker on localhost:3307 (creates alpharecover + alpharecover_test)
cp .env.example .env          # then fill the three secrets: openssl rand -base64 32
npm run db:migrate            # create tables
npm run db:seed               # load the training catalog (safe to re-run)
npm run dev:api               # API on http://localhost:8787 (Vite proxies /api to it)
curl localhost:5173/api/v1/health
```

Without a `POSTMARK_SERVER_TOKEN`, emails are printed to the API log instead of being sent.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Oxlint |
| `npm run dev:api` | API server with reload (`server/`) |
| `npm run build:api` | Production API bundle → `dist-server/` |
| `npm test` | Unit + MySQL integration tests (DB tests skip if MySQL isn't running) |
| `npm run db:up` / `db:down` | Start / stop local MySQL (Docker) |
| `npm run db:generate` | SQL migration from schema changes |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run db:seed` | Insert the catalog from `content.ts` (insert-only; never overwrites) |

## Stack

- Frontend: Vite + React + TypeScript, React Router, custom CSS (no UI kit)
- API (Phase 1 foundation): Node.js + Hono, MySQL + Drizzle, Better Auth. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

The pages don't call the API yet: auth, payments, leads and the training portal are still UI stubs. Progress is tracked in [docs/PLAN.md](docs/PLAN.md).

## Brand

- **Name:** Alpha Recover
- **Email:** info@alpharecover.com
- **Phone:** +91 63551 97917
- **Address:** Ahmedabad, Gujarat, India

## Routes

| Path | Page |
|------|------|
| `/` | Home |
| `/training` | Training solutions |
| `/training/:trackId` | Training track (modules + lessons) |
| `/pricing` | Professional Plan |
| `/demos` | Demo videos |
| `/contact` | Contact |
| `/account` | Login / Register |
| `/about` | About us |
| `/services` | Services |
| `/industries` | Industries |
| `/blog` | Blog |
| `/blog/:slug` | Blog post |
| `/verify-certificate` | Verify certificate |
| `/verify-email` | Email verification (link from email) |
| `/reset-password` | Choose a new password (link from email) |

## Documentation

| Doc | Contents |
|-----|----------|
| [AGENTS.md](AGENTS.md) | Rules for AI coding agents and developers (conventions, docs-update rule, git workflow) |
| [docs/PRD.md](docs/PRD.md) | Product requirements, flows, frontend → backend mapping, open decisions |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Frontend structure, planned backend stack, hosting checklist |
| [docs/DESIGN.md](docs/DESIGN.md) | Design system: tokens, typography, icons, imagery, motion |
| [docs/DATABASE.md](docs/DATABASE.md) | Database schema (planned, MySQL) |
| [docs/API.md](docs/API.md) | API specification (planned) |
| [docs/SECURITY.md](docs/SECURITY.md) | Authentication, roles & permissions, security |
| [docs/TESTING.md](docs/TESTING.md) | QA & testing strategy |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | cPanel / VPS deployment, cron, migrations, rollback, troubleshooting |
| [docs/PLAN.md](docs/PLAN.md) | Implementation roadmap and status |
| [docs/admin/](docs/admin/ARCHITECTURE.md) | Admin panel plan (proposal): architecture, folder structure, navigation, auth & RBAC, UI/UX, security |
