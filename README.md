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

No environment variables are needed for the frontend today. Backend setup (MySQL, `.env.example`) will be added here when the backend is built.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Oxlint |

## Stack (UI only)

- Vite + React + TypeScript
- React Router
- Custom CSS (no UI kit)

Auth, payments, and the training portal backend are not wired yet. Forms are UI stubs. The backend is planned in [docs/](docs/PLAN.md).

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
| [docs/PLAN.md](docs/PLAN.md) | Implementation roadmap and status |
