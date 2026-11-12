# AGENTS.md

Instructions for AI coding agents (Cursor, Claude Code) and developers working in this repo. **Both Cursor and Claude Code follow this file** (Claude Code loads it through `CLAUDE.md`). Keep it short and current.

## What this is

**Alpha Recover**: a marketing + training site for an Ahmedabad data recovery training and services business (logical, electrical/PCB, mechanical and firmware recovery courses; Professional Plan pricing; demo videos).
The frontend is complete, but its forms are still **UI stubs** (`alert()` / `setNote(...)`). The **API foundation** (Phase 1: `server/`, Node + Hono + MySQL + Better Auth) exists; features get wired phase by phase (see `docs/PLAN.md`).

- Live (temporary): https://recova-sand.vercel.app. Production hosting is undecided (cPanel or VPS).
- Brand and contact details live in `company` in `src/data/content.ts`. Never hard-code them elsewhere.

## Commands

```bash
npm run dev        # Vite dev server → http://localhost:5173 (proxies /api → :8787)
npm run dev:api    # API server (needs .env + MySQL: npm run db:up && npm run db:migrate)
npm run build      # tsc -b (app + server) && vite build — use this to verify changes
npm run build:api  # API bundle → dist-server/
npm run lint       # oxlint (.oxlintrc.json), covers src/ and server/
npm test           # Vitest: unit + MySQL integration tests
npm run db:generate  # after editing server/db/schema.ts → commit the new migration
```

Verify with `npm run build` + `npm run lint` + `npm test`; for visual changes, run the dev server and check 390 / 768 / 1024 / 1440px.

## Documentation map

| Doc | Read it when you… |
|---|---|
| [README.md](README.md) | need setup, scripts, the route list |
| [docs/PRD.md](docs/PRD.md) | need to know *what* to build and why (requirements, flows, open decisions) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | need structure, stack, routes, hosting, planned repo layout |
| [docs/DESIGN.md](docs/DESIGN.md) | build or change UI (tokens, icons, imagery, motion, breakpoints, CSS conventions) |
| [docs/DATABASE.md](docs/DATABASE.md) | touch data models or migrations |
| [docs/API.md](docs/API.md) | add or change endpoints or frontend API calls |
| [docs/SECURITY.md](docs/SECURITY.md) | touch auth, roles, permissions, payments, secrets |
| [docs/TESTING.md](docs/TESTING.md) | write tests or prepare a release |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | deploy, configure the host, cron, rollback, troubleshoot |
| [docs/PLAN.md](docs/PLAN.md) | need the roadmap and phase status |
| `docs/archive/` | historical snapshots: read-only, never update |

## Code conventions

- Stack: Vite 8 · React 19 · TypeScript 6 · React Router 7 · plain CSS. Runtime deps are only `react`, `react-dom`, `react-router-dom`: keep it lean, and don't add packages for things plain CSS/React already handles.
- Named function exports for components (`export function Home()`); only `App` is a default export.
- 2-space indent, single quotes, semicolons, trailing commas. `import type` for type-only imports.
- Content changes go in `src/data/content.ts`, not inline in JSX.
- New components go in the matching folder: app shell → `components/layout/`, page section → `components/sections/`, image/visual helpers → `components/visuals/`, generic piece → `components/ui/`.
- Styles live next to their component (`Foo.tsx` + `Foo.css`) with a **unique class prefix**: all CSS ships in one bundle. Use tokens from `src/styles/global.css`, never new hex values. Details: [docs/DESIGN.md](docs/DESIGN.md).
- Icons: local SVGs only via `icons.*` / `iconSrc()` in `src/lib/icons.ts`. Images: optimized `.webp` in `public/assets/`.
- Animations: wrap in `<Reveal>` and honour `prefers-reduced-motion`.

### Backend conventions (`server/`)

- Routes are small Hono routers in `server/routes/`, mounted in `server/app.ts` under `/api/v1`. Get dependencies from `c.get('deps')`; never import a global db.
- Throw `AppError(code, message)` for expected failures; the error handler renders the envelope from docs/API.md §0. Validate every input with `validate('json' | 'query' | 'param', zodSchema)`.
- Guard routes with `requireUser()` or `requireStaff('<permission>')`; permissions live in `server/auth/permissions.ts` and must match docs/SECURITY.md §2.
- Never send email inline: `enqueueEmail()` and let the cron drain it.
- Admin mutations and security events call `logActivity()`.
- Schema changes: edit `server/db/schema.ts`, run `npm run db:generate`, commit the SQL. Expand/contract only (docs/DEPLOYMENT.md §5). Keep it MySQL 8 **and** MariaDB 10.6 compatible (CI tests both).
- Every new route gets integration tests in `server/**/*.test.ts` against real MySQL.

### Known lint warnings (pre-existing)

`react(only-export-components)` in `demoVisuals.tsx` / `pricingVisuals.tsx`; `set-state-in-effect` in `Header.tsx`, `ProfessionalPlanSection.tsx`; `purity` (`Date.now` in `Countdown`). Don't introduce new ones.

## Documentation update rule

Docs change **in the same commit/PR as the code** that makes them outdated.

| When you change… | Update |
|---|---|
| Routes, folder structure, stack, hosting | `docs/ARCHITECTURE.md` (+ route list in `README.md`) |
| Design tokens, a new UI pattern, icon variants, breakpoints | `docs/DESIGN.md` |
| A migration or schema | `docs/DATABASE.md` |
| An endpoint (added, changed, removed) | `docs/API.md` |
| Auth, roles, permissions, a security control, secrets | `docs/SECURITY.md` |
| Scope or a requirement; an open decision gets answered | `docs/PRD.md` |
| A phase finishes or is re-planned | `docs/PLAN.md` |
| A new script, env var or setup step | `README.md` + `.env.example` (+ `docs/DEPLOYMENT.md` §2 for env vars) |
| Deployment, cron or hosting steps | `docs/DEPLOYMENT.md` |
| A new convention or agent rule | `AGENTS.md` |

Guard rails:
- Edit only the affected section; never rewrite unrelated parts of a doc.
- Document what the code actually does. Never describe behaviour that isn't implemented. Mark planned items as planned.
- Link to the source of truth instead of copying it (token values, schema columns, content).
- Bump the doc's `Last reviewed` date when you change it.
- Never edit files in `docs/archive/`.
- If no doc needs updating, say why in the PR description.

## Git workflow

- **Work on a feature branch** (`feat/…`, `fix/…`, `docs/…`) and open a PR. Don't commit straight to `main`.
- **One AI tool per branch.** Cursor and Claude Code must not edit the same branch at the same time.
- **Commit messages must describe the actual diff.** Never reuse a message from a different change.
- **Never commit or push another tool's or person's uncommitted work** without asking.
- Don't push, merge or deploy without explicit confirmation from the user.

## Don'ts

- Don't read or print `.env*` files or `.vercel/.env*` (secrets).
- Don't edit `dist/`, `dist-server/`, `.vercel/`, `node_modules/` or `.venv-rembg/` (a local Python venv for the `rembg` image tool, not part of the app).
- Don't deploy (`vercel`, `vercel --prod`) without explicit confirmation.
- Don't redesign existing UI or change routes unless asked.
