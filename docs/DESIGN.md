# Alpha Recover — Design System

**Last reviewed:** 2026-11-12
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

- Contrast ratios are noted next to each token in `global.css`; keep text on `--bg`/`--surface` at the listed tokens to stay AA-compliant.
- **Mint** (`#7DFFC0`) is the glow/highlight colour used in glass panels and icon variants. It's currently hard-coded rather than tokenized. If you add new mint usages, introduce a `--mint` token rather than repeating the hex.
- The **compat aliases** at the bottom of `:root` (`--bg-card`, `--heading`, `--cyan`…) exist for older CSS. Don't use them in new code; use the primary names above.

## 3. Typography

| Token | Font | Use |
|---|---|---|
| `--font-display` | **Syne** (600–800) | `h1`–`h4`, brand wordmark, big numbers |
| `--font-body` | **Manrope** (400–700) | Everything else |

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
| Buttons | `.btn`, `.btn-primary` (ivory), `.btn-ghost` (outline), `.btn-cyan` | Section-specific variants (`pp-btn-*`, `tx-btn-*`, `demos-btn-*`) follow the same states |
| Form fields | `.field` (label + input/select/textarea), `.check` (checkbox row) | Account page uses its own `acc-*` field styling with leading icons |
| Panels / cards | `.panel`, glass tokens (`--glass-bg`, `--glass-border`, `--glass-shadow`, `--glass-blur`) in `glass.css` | Use the glass tokens for new elevated cards |
| Glass "orb" icons | `--glass-orb-*` tokens | Round 3D icon badges (pricing perks) |
| Accent bar | `.why-accent-bar` / `.training-accent-bar` in `src/styles/sections.css` | Short gradient bar above section titles |
| Sticky stacked cards | `stack-card*` in `components/sections/SolutionsStack.css` | Mobile/tablet sticky-sibling card stack used by three sections |
| Tabs / filters | Account toggle, TrainingExplorer tracks, Demos filters | `role="tab"`, `aria-selected`, `is-active` class |
| Form states | `.field-error`, `.form-error`, `.form-success`, `.hp-field` (honeypot), `.turnstile-box` in `global.css`; `.success` (page-scoped in `SimplePages.css`) | Use these for every API-backed form: errors in `--danger`, success in `--ok`. The `<Turnstile>` widget lives in `src/components/ui/Turnstile.tsx`; `submitLead()` / `formErrors()` in `src/lib/leads.ts` |
| Floating actions | WhatsApp float, scroll-to-top | Bottom corners; keep new floating UI clear of them |
| Article content | `.prose` (in `SimplePages.css`) + `<Markdown source>` from `src/components/ui/Markdown.tsx` | Headings (`#`/`##` → h2), lists, quotes (brass left border), code blocks (`--dark-band`), inline code (`--chip`), brass underlined links |

## 6. Icons

- **Local SVG files only, no icon CDN.** Files live in `public/icons/` named `<set>__<name>__<variant>.svg` (e.g. `lucide__shield__mint.svg`).
- Resolve paths with `iconSrc('lucide/shield', ICON_WHITE)` or the prebuilt map `icons.*` from [`src/lib/icons.ts`](../src/lib/icons.ts).
- Variants: `mint` (default), `white`, `dark`, `ivory`, `wa` (WhatsApp green).
- Sets: Lucide (`lucide/*`) for UI glyphs, MDI (`mdi/*`) for brand and device icons.
- **Adding an icon:** export the SVG from Iconify in each colour variant you'll use, save it with the naming pattern above, then add an entry to `icons`.
- Render as `<img src={…} alt="" width height decoding="async" />` inside an element with `aria-hidden` when decorative.

## 7. Imagery

- Photos are optimized **WebP** in `public/assets/`, referenced by absolute path (`/assets/pcb.webp`); section → image maps live in [`src/data/sectionMedia.ts`](../src/data/sectionMedia.ts).
- Above-the-fold images are preloaded in `index.html`.
- Use `loading="lazy"` / `fetchPriority="low"` for below-the-fold images; always set `width`/`height` to avoid layout shift.
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

## 11. Building new screens (dashboard, player, admin)

1. Start from `.page-hero` + `.breadcrumb` + `.container` + `.section`.
2. Use glass panel tokens for cards, `.btn-primary` / `.btn-ghost` for actions, `.field` for forms.
3. Pick a new unique class prefix for the screen (e.g. `dash-*`, `player-*`, `adm-*`).
4. Use `--ok` / `--danger` for status; `--brass` sparingly for emphasis.
5. Check all four target widths and reduced motion before merging.
