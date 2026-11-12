# CLAUDE.md

Guidance for Claude Code in this repo. Originally built with Cursor — keep existing files/docs (`README.md`, etc.) as they are unless asked.

## What this is

**Alpha Recover** — marketing + training site for an Ahmedabad data recovery training/services business (logical, electrical/PCB, mechanical, firmware recovery courses; Professional Plan pricing; demo videos).
Frontend only. Auth, payments, lead capture, lesson player and certificate verification are **UI stubs** (`alert()` / `setNote(...)` placeholders) — no backend exists yet.

- Live: https://recova-sand.vercel.app (Vercel project `recova`, SPA rewrite in `vercel.json`)
- Brand/contact details live in `company` in `src/data/content.ts` — never hardcode them elsewhere.

## Commands

```bash
npm run dev      # Vite dev server → http://localhost:5173
npm run build    # tsc -b && vite build  (use this to verify changes)
npm run lint     # oxlint (.oxlintrc.json)
npm run preview  # serve dist/
```

No test suite. Verify with `npm run build` + `npm run lint`; for visual changes, run the dev server and check desktop + mobile widths.

## Stack

Vite 8 · React 19 · TypeScript 6 (strict-ish: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`) · React Router 7 · plain CSS (no UI kit, no Tailwind). Node 24.

Runtime dependencies are just `react`, `react-dom` and `react-router-dom` — keep it lean; don't add packages for things plain CSS/React already handles.

## Layout

```
src/
  main.tsx              BrowserRouter + global.css
  App.tsx               All routes, nested under <Layout/>; unknown paths → "/"
  components/
    layout/             App shell on every page: Layout (Header, <Outlet/>, Footer, ScrollToTop,
                        WhatsAppFloat, RouteScrollReset)
    sections/           Big page sections reused across routes (Home, /pricing, /demos, /training,
                        /contact), each *.tsx with its colocated *.css. SolutionsStack.css also holds
                        the shared sticky stack-card styles used by ProTraining + DemoVideos sections.
    visuals/            *Visuals.tsx: image/icon maps + small visual components for sections
                        (PageHddVisual.tsx is currently unused)
    ui/                 Small generic building blocks — Reveal (IntersectionObserver fade-in; adds
                        .is-in; respects reduced motion)
  pages/                One file per route; CSS colocated (Home.css = Home-only: hero, global stats, why-learn)
  data/content.ts       ALL copy/data: company, stats, trainingTracks, demoVideos, pricing, services, industries, blogPosts
  data/sectionMedia.ts  Section → /assets image maps
  lib/icons.ts          iconSrc('lucide/name', color) → /icons/lucide__name__<color>.svg
  styles/global.css     Design tokens (:root vars), base, buttons, container
  styles/glass.css      Glass/blur surface styles
  styles/sections.css   Accent bars shared across sections (.why-accent-bar, .training-accent-bar)
public/
  assets/               Compressed .webp/.png images referenced as '/assets/...'
  icons/                Pre-exported Iconify SVGs, one file per icon+color variant
```

Routes: `/`, `/training`, `/training/:trackId`, `/pricing`, `/demos`, `/contact`, `/account`, `/about`, `/services`, `/industries`, `/blog`, `/blog/:slug`, `/verify-certificate`.

## Conventions

- Named function exports for components (`export function Home()`); only `App` is a default export.
- 2-space indent, single quotes, semicolons, trailing commas. `import type` for type-only imports.
- Content changes go in `src/data/content.ts`, not inline in JSX.
- Styling: use CSS vars from `global.css` (`--bg`, `--surface`, `--text`, `--content`, `--brass`, `--ok`, `--line`, …). Dark pine/ivory/brass palette; fonts Manrope (body) + Syne (display). BEM-ish kebab-case class names scoped by section prefix (`hero-*`, `cta-*`).
- Icons: local SVGs only (no CDN). Use `icons.*` or `iconSrc()`. Variants: `mint`, `white`, `dark`, `ivory`, `wa`. A new icon needs a matching file in `public/icons/` for each color used.
- Images: add as optimized `.webp` under `public/assets/`; reference by absolute path.
- Animations: wrap in `<Reveal>`; honor `prefers-reduced-motion`.
- New components go in the matching `components/` subfolder: app shell → `layout/`, page section → `sections/`, image/visual helpers → `visuals/`, generic reusable piece → `ui/`.
- Section styles live next to their component (`Foo.tsx` + `Foo.css`). All routes are eagerly imported, so every CSS file ends up in one bundle — class prefixes must stay unique per section to avoid cross-file cascade clashes.
- Mobile matters — sections use many `max-width` breakpoints (560/640/900/980/1024/1100/1280px).

## Known lint warnings (pre-existing)

`react(only-export-components)` in `demoVisuals.tsx` / `pricingVisuals.tsx`; `set-state-in-effect` in `Header.tsx`, `ProfessionalPlanSection.tsx`; `purity` (`Date.now` in `Countdown`). Don't introduce new ones.

## Don'ts

- Don't read or print `.env.local` or `.vercel/.env.production.local` (Vercel OIDC token).
- Don't edit `dist/`, `.vercel/output/`, `node_modules/`, `.venv-rembg/` (local Python venv for `rembg` image background removal — a tool, not part of the app).
- Don't deploy (`vercel`, `vercel --prod`) without explicit confirmation.
