# Alpha Recovery — Design System

**Last reviewed:** 2026-11-25
**Scope:** how the UI looks and how to build new screens that match it (student dashboard, lesson player, checkout pages, admin). How the code is organized lives in [ARCHITECTURE.md](ARCHITECTURE.md).

> **Source of truth:** token values live in [`src/styles/global.css`](../src/styles/global.css) (`:root`). This doc explains *what to use when*. It deliberately doesn't copy values, so it can't drift from the CSS.

---

## 1. Look and feel

A dark, technical "lab" aesthetic: deep pine-green backgrounds, ivory text, brass accents, mint glows, frosted-glass panels, subtle grids and dot patterns. Photography of drives, PCBs and tools. Calm motion (fade/rise on scroll, slow spins on decorative rings).

## 2. Colour tokens (use the variable, never the hex)

| Token | Use for |
|---|---|
| `--bg` | Page background |
| `--surface` | Cards, panels (recessed) |
| `--surface-alt` | Alternate section bands |
| `--dark-band` | Footer, pricing band, strongest contrast bands |
| `--text` | Headings, logo, high-emphasis text |
| `--text-sub` | Subheadings |
| `--content` | Body copy, muted text |
| `--line` | Dividers, card borders |
| `--line-strong` | Outline buttons, rings, focus outlines |
| `--btn` / `--btn-hover` / `--btn-active` / `--btn-text` | Primary (ivory) button states |
| `--chip` | Secondary button and tag backgrounds |
| `--brass` | Eyebrows/kickers, sale badges, key accents |
| `--brass-text` | Text placed **on** brass |
| `--ok` | Success / "recovered" states |
| `--danger` | Errors, destructive actions |
| `--mint` / `--mint-ink` | Mint accent (icon glows, pill buttons, active states) and the dark text placed **on** mint |

- Contrast ratios are noted next to each token in `global.css`; keep text on `--bg`/`--surface` at the listed tokens to stay AA-compliant.
- **Mint** is now the `--mint` token. Older CSS still repeats `#7DFFC0`; new code uses the token (mix it with `color-mix()` for borders and glows).
- The **compat aliases** at the bottom of `:root` (`--bg-card`, `--heading`, `--cyan`…) exist for older CSS. Don't use them in new code; use the primary names above.

## 3. Typography

| Token | Font | Use |
|---|---|---|
| `--font-display` | **Syne** (600–800) | `h1`–`h4`, big numbers |
| `--font-body` | **Manrope** (400–700) | Everything else |
| `--font-logo` | Arial / Helvetica (bold, uppercase) | Text that reproduces the logo wordmark (the home hero "ALPHA RECOVERY") |

Fonts load from Google Fonts at the top of `global.css`. Base body size is 16px, line-height 1.6. Headings often use an `<em>` for a highlighted second phrase ("Get in *Touch*", "Demo *Videos*"). Keep that pattern for new page titles.

## 4. Layout & spacing

| Token / class | Use |
|---|---|
| `.container` | Centered content column, max width `--max`, with a mobile gutter |
| `--header` | Fixed header height (used for sticky offsets) |
| `.section` + `--section-y` / `--section-y-sm` | Vertical rhythm between bands (smaller on phones) |
| `.section-head`, `--section-head-gap` | Section title block spacing |
| `.page-hero` + `.breadcrumb` | Top band of inner pages (title + breadcrumb trail) |
| `.grid-2`, `.grid-3` | Simple responsive grids (collapse at 900px) |
| `--radius` | Default corner radius (cards use larger, explicit radii) |

## 5. Components & patterns already available

| Pattern | Where | Notes |
|---|---|---|
| Buttons | `.btn` + `.btn-primary` / `.btn-ghost` / `.btn-cyan`; section variants (`pp-btn-*`, `tx-btn-*`, `demos-btn-*`, …) | **One site button look**: the soft ivory → teal gradient (the hero "Demo Videos" pill), from the `--btn-soft-*` tokens in `global.css` (background, hover, active, text, border, shadow). New buttons use those tokens. **Homepage exception:** the homepage keeps its original buttons (brass "View Plan", outline buttons); page sections shared with other pages (pricing card, training explorer) switch to the site look only under `:root:not([data-home])` (`Layout.tsx` sets `data-home` on `/`). **Header / footer:** the marketing `Header` is on every public page, including logged-out `/account` and logged-out `/dashboard`. The footer and WhatsApp float are hidden on `/account` and `/dashboard`. Signed-in `/dashboard` and `/account/settings` use `LearnerShell` (`lrn-`) instead of the marketing header. Those screens still use `--btn-soft-*` for primary actions (not a mint fill) |
| Form fields | `.field` (label + input/select/textarea), `.check` (checkbox row) | Account page uses its own `acc-*` field styling with leading icons |
| Panels / cards | `.panel`, glass tokens (`--glass-bg`, `--glass-border`, `--glass-shadow`, `--glass-blur`) in `glass.css` | Use the glass tokens for new elevated cards |
| Glass "orb" icons | `--glass-orb-*` tokens | Round 3D icon badges (pricing perks) |
| Accent bar | `.why-accent-bar` / `.training-accent-bar` in `src/styles/sections.css` | Short gradient bar above section titles |
| Sticky stacked cards | `stack-card*` in `components/sections/SolutionsStack.css` | Mobile/tablet sticky-sibling card stack used by three sections |
| Tabs / filters | Account toggle, TrainingExplorer tracks, Demos filters | `role="tab"`, `aria-selected`, `is-active` class |
| Form states | `.field-error`, `.form-error`, `.form-success`, `.hp-field` (honeypot), `.turnstile-box` in `global.css`; `.success` (page-scoped in `SimplePages.css`) | Use these for every API-backed form: errors in `--danger`, success in `--ok`. The `<Turnstile>` widget lives in `src/components/ui/Turnstile.tsx`; `submitLead()` / `formErrors()` in `src/lib/leads.ts` |
| Floating actions | WhatsApp float, scroll-to-top | Bottom corners; keep new floating UI clear of them |
| Inner-page hero | `<PageHero crumbs title sub art>` in `src/components/ui/PageHero.tsx` (`ph-`) | Breadcrumb, title, subtitle, optional chips (children) and a glowing illustration (`heroArt` in `src/data/pageContent.ts`); used by Services, Industries, Blog, Training track, Verify Certificate. The illustration hides below 760px |
| Learner chrome | `LearnerShell` / `AuthTopBar` in `src/components/layout/LearnerShell.tsx` (`lrn-`, `auth-top`); assets in `public/assets/alpha-recovery-assets/` via `src/lib/learnerAssets.ts` | Premium dark emerald shell for signed-in `/dashboard` and `/account/settings`. Logged-out `/account` and `/dashboard` use the marketing header; a signed-in `/account` visit redirects to `/dashboard`. `AuthTopBar` remains for the logged-out gate on `/account/settings` only. Sidebar: My Learning (`/dashboard`, page title “Welcome back, {first name} 👋”), courses/progress/certificates tabs (one section at a time), Account settings, Support. The name chip shows `users.image` when set (else the placeholder) and opens a menu with Log out and Log out of all devices; both return to `/account`. Photos are uploaded under Account settings. Mobile bottom bar keeps the main learning links; More includes My Learning, Account settings and Support. Upgrade card shows when `hasActiveEnrollment` is false (Professional Plan → `/pricing`). Stats and progress come from `GET /me/dashboard` — no invented totals |
| Icon cards | `<IconCard item>` in `.ic-grid` (`src/components/ui/IconCard.tsx`, `ic-`) | Icon tile + title + text + mint pill link; 3 / 2 / 1 columns |
| Feature strip | `<FeatureStrip items>` (`src/components/ui/FeatureStrip.tsx`, `fs-`) | Bordered row of icon highlights at the bottom of inner pages; 4 → 2 → 1 columns |
| Article content | `.prose` (in `SimplePages.css`) + `<Markdown source>` from `src/components/ui/Markdown.tsx` | Headings (`#`/`##` → h2), lists, quotes (brass left border), code blocks (`--dark-band`), inline code (`--chip`), brass underlined links |
| Page title & meta | `src/data/seo.ts` (`pageSeo()`), applied by `<PageMeta/>` in `Layout` | Every public page's `<title>`, description, canonical, share card (`/assets/brand/og-image.jpg`, 1200×630) and JSON-LD. A new public route needs an entry there (it's then pre-rendered and listed in the sitemap). Don't set `document.title` in pages; a page with API-only content can refine it with `applyPageMeta()` (see `BlogPost`) |

## 6. Icons

- **Local SVG files only, no icon CDN.** Files live in `public/assets/icons/` named `<set>__<name>__<variant>.svg` (e.g. `lucide__shield__mint.svg`).
- Resolve paths with `iconSrc('lucide/shield', ICON_WHITE)` or the prebuilt map `icons.*` from [`src/lib/icons.ts`](../src/lib/icons.ts).
- Variants: `mint` (default), `white`, `dark`, `ivory`, `wa` (WhatsApp green).
- Sets: Lucide (`lucide/*`) for UI glyphs, MDI (`mdi/*`) for brand and device icons.
- **Adding an icon:** export the SVG from Iconify in each colour variant you'll use, save it with the naming pattern above, then add an entry to `icons`.
- Render as `<img src={…} alt="" width height decoding="async" />` inside an element with `aria-hidden` when decorative.

## 7. Imagery

- **All assets live in `public/assets/`**: `brand/` (logos, favicons, apple-touch icon), `icons/` (UI SVGs, §6), and `images/` split into `backgrounds/`, `sections/` (photos in sections and cards), `illustrations/` (hero art, globe) and `stat-icons/`.
- Photos are optimized **WebP** in `public/assets/images/`, referenced by absolute path (`/assets/images/sections/pcb.webp`); section → image maps live in [`src/data/sectionMedia.ts`](../src/data/sectionMedia.ts).
- Inner-page hero illustrations (`public/assets/images/illustrations/page-*.webp`: hard drive, laptop + drive, certificate, light wave) are cut from the brand asset sheet with transparent backgrounds and exported at 2× (Lanczos + light sharpen) so they stay crisp on high-DPI screens; the sheet is only 1536×1024, so a higher-resolution sheet is the way to get more real detail; the source sheet and the redesign references (`alpha_recovery_assets/`) are kept outside the repo.
- Above-the-fold images are preloaded in `index.html`.
- Use `loading="lazy"` / `fetchPriority="low"` for below-the-fold images; always set `width`/`height` to avoid layout shift.
- **Logo and favicons** live in `public/assets/brand/` (usage in its `README.txt`); paths are in `brandLogo` in `src/data/content.ts`. Public header/drawer use `alpha-logo-header.svg`, the footer `alpha-logo-footer.svg` (tagline included), and the admin `BrandLogo` the tiled mark (`favicon.svg`) plus theme-aware text, since the wordmark's white text vanishes on the light admin theme.
- Don't hot-link third-party images. (Demo thumbnails currently hot-link Unsplash; these should move to own storage with the backend.)

## 8. Motion

- Scroll reveal: wrap blocks in `<Reveal>` ([`src/components/ui/Reveal.tsx`](../src/components/ui/Reveal.tsx)). It adds `.is-in` on intersection; `.reveal` / `.reveal.is-in` in `global.css` define the rise animation.
- Decorative keyframes in `global.css`: `rise`, `platter-spin`, `pulse-ring`, `float-soft`.
- **Always honour `prefers-reduced-motion`**: `Reveal` shows content immediately, and `global.css` disables animations under that media query. New animations must do the same.

## 9. Responsive design

- Design and test at **390, 768, 1024 and 1440px** at minimum.
- Common breakpoints in the CSS: 560, 600, 640, 900, 980, 1024, 1100, 1280, 1440px (`max-width` queries, desktop-first).
- Mobile patterns: navigation drawer, sticky card stacks, "show more" toggles for long lists (pricing features).

## 10. CSS conventions

- One CSS file next to each section/page component (`Foo.tsx` + `Foo.css`); shared primitives in `src/styles/`.
- **BEM-ish kebab-case class names with a unique section prefix** (`hero-*`, `pp-*` pricing, `cta-*`, `dv-*` demo cards, `tx-*` training explorer). All CSS ships in one bundle, so prefixes prevent cross-file clashes.
- Use tokens for colour, spacing and type; avoid new hard-coded hex values.
- Accessibility: visible `:focus-visible` outlines (defined globally), labelled form fields, `aria-hidden` on decorative elements, `alt` text on meaningful images.
- **Pre-render safe:** public pages are rendered to HTML at build time and hydrated (docs/ARCHITECTURE.md §5.1), so the first render must not read `window`, `document`, `localStorage`, screen size or the current time. Read them in effects, start from a fixed default (e.g. `useState(false)`, then sync in the effect), and gate browser-only markup such as portals with `useHydrated()`.

## 11. Building new screens (dashboard, player, admin)

1. Start from `.page-hero` + `.breadcrumb` + `.container` + `.section` for marketing pages. Logged-out `/account` uses that same header. For `/dashboard` and `/account/settings`, start from `LearnerShell` and the `dsh-*` / `auth-*` / `acc-*` patterns already on those pages.
2. Use glass panel tokens for cards, `.btn-primary` / `.btn-ghost` (or `.account-submit`) for actions — keep `--btn-soft-*`, do not invent a mint primary button.
3. Pick a new unique class prefix for the screen (e.g. `dsh-*`, `player-*`, `adm-*`, `lrn-*`).
4. Use `--ok` / `--danger` for status; `--brass` sparingly for emphasis.
5. Check all four target widths and reduced motion before merging.
