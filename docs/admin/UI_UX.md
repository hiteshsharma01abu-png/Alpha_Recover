# Alpha Recover — Admin Panel UI/UX Plan

**Last reviewed:** 2026-11-13 · **Status:** Proposal
**Related:** [NAVIGATION.md](NAVIGATION.md) · [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) · public design system: [../DESIGN.md](../DESIGN.md)

> **Hard rule:** the public website's look doesn't change. All admin styles live under the `.adm` root (class prefix `adm-`) in `src/admin/**`. `src/styles/global.css` and public components aren't edited for the admin.

## 1. Design direction

A **calm, premium operations console** in the Alpha Recover brand. It uses the public site's identity (pine green, ivory, brass accents, mint highlights; Syne and Manrope type) but tuned for density and long work sessions:

- **Content first:** data is the hero. Fewer glows and decorative grids than the marketing site, with brand accents saved for focus, active state and key numbers.
- **Predictable patterns:** every list, detail and edit flow looks and behaves the same across modules.
- **Fast:** skeletons instead of spinners, optimistic updates for small edits, keyboard shortcuts.
- **Trustworthy:** destructive and financial actions are explicit (typed confirmation, step-up, clear amounts).

## 2. Themes (dark and light)

Both themes are defined as CSS custom properties on `.adm[data-theme]`. The toggle offers **System / Light / Dark**, stored per browser, defaulting to System (`prefers-color-scheme`).

| Token | Dark (from the public palette) | Light (proposed) | Use |
|---|---|---|---|
| `--adm-bg` | `#0A1B16` (`--dark-band`) | `#F6F4EE` (paper) | App background |
| `--adm-surface` | `#0D231D` (`--surface`) | `#FFFFFF` | Cards, tables, drawers |
| `--adm-surface-2` | `#123128` (`--bg`) | `#EFEBE1` | Hover rows, sidebar, inputs |
| `--adm-text` | `#F0EDE4` | `#10271F` | Primary text |
| `--adm-text-2` | `#A9C2BC` | `#4A6159` | Secondary text |
| `--adm-line` | `#1F5E57` | `#DDD6C6` | Borders, dividers |
| `--adm-accent` | `#D9B56E` (brass) | `#94701F` (deep brass) | Active nav, primary emphasis, focus ring |
| `--adm-primary-bg` / `-fg` | `#F0EDE4` / `#123128` (ivory button) | `#123128` / `#F6F4EE` (pine button) | Primary buttons |
| `--adm-success` | `#8EE0B5` | `#1D7F55` | Paid, valid, converted |
| `--adm-warning` | `#E8C46A` | `#8A6100` | Pending, expiring |
| `--adm-danger` | `#F08A7A` | `#B3261E` | Failed, revoked, destructive |
| `--adm-info` | `#7DFFC0` (mint) | `#0F766E` | Links, info badges |

Light values are proposals and must be **checked for WCAG AA contrast** (4.5:1 for text, 3:1 for UI) during implementation. Status colours are never the only signal: badges always carry text, and icons where useful.

## 3. Layout

```
┌──────────── sidebar ────────────┬──────────────────────── top bar ────────────────────────┐
│  Alpha Recover · Admin          │  ☰  Leads & Inquiries   Home / Leads    ⌕  ◐  [RP ▾]    │
│  OVERVIEW                       ├─────────────────────────────────────────────────────────┤
│   ▸ Dashboard                   │  Page header: title · description · [ + Primary action ] │
│  SALES                          │  Filter bar: search · status · reason · date · ⋯ · Export│
│   ▸ Leads & Inquiries  ●        │  ┌──────────────── data table ───────────────────────┐   │
│   ▸ Orders & Payments           │  │ ☐ Name     Phone        Reason   Status  Created  │   │
│  LEARNERS …                     │  │ ☐ …                                               │   │
│                                 │  └───────────────────────────────────────────────────┘   │
│  [RP] Ravi P · Super Admin      │  Showing 1–25 of 142            ‹ 1 2 3 … 6 ›  25 ▾       │
│  View website ↗                 │                                     (row → right drawer) │
└─────────────────────────────────┴─────────────────────────────────────────────────────────┘
```
- **Sidebar:** 264px expanded or a 72px rail; behaviour by breakpoint in [NAVIGATION.md](NAVIGATION.md) §4.
- **Top bar:** sticky, 64px, holding the page title and breadcrumbs, global search (P2, `⌘K`), the theme toggle and the user menu (account, 2FA, sessions, sign out).
- **Content:** fluid width with a max of 1440px; 24px gutters on desktop, 16px on mobile.
- **Typography:** Manrope for UI (14px base in tables, 15px in forms), Syne only for page titles and KPI numbers, and **tabular numerals** for amounts, counts and dates.

## 4. Core patterns

### Dashboard
- **KPI cards** (4 per row on desktop, 2 on tablet, 1 on mobile). Each has a value, a label, a delta vs the previous period (▲/▼ with colour and text) and a link to the filtered list. Examples: New leads (today / 7d), Uncontacted leads, Lead → student conversion, Revenue 30d (finance), Published lessons / with video (content), Active sale ends in (plans).
- **Widgets:** recent leads (5 rows), promotion status with countdown, content health (lessons without video, posts that are only an excerpt), email-delivery problems.
- Widgets render according to role permissions; nothing appears that a role can't open.

### Data tables (`DataTable`)
- Server-side pagination (25 by default; 10/25/50/100), sorting on indexed columns, and column visibility.
- **Table state lives in the URL** (`?page=2&status=new&q=ravi`), so views are shareable and survive refresh.
- Row click opens a **right drawer** for detail and quick edit. Full pages are only for complex editors (course outline, blog post, order detail).
- **Bulk actions** (selected rows): e.g. assign, change status, export selection. Confirmation shows the count.
- Sticky header, zebra-free rows with hover highlight, truncation with a tooltip, ₹ amounts right-aligned.
- **Mobile (< 768px):** rows become stacked cards showing the 3–4 key fields, with the row menu kept.

### Search and filters (`FilterBar`)
- Debounced search (300ms), filter chips with clear buttons, "Reset filters", and a result count.
- Date range presets: Today, 7 days, 30 days, This month, Custom (IST).

### Drawers and modals
- **Drawer** (480–640px, full screen on mobile): view and edit a record. Unsaved changes prompt before closing.
- **Modal:** short decisions only (confirm, grant enrollment, issue certificate).
- **Destructive or financial confirmations:** state exactly what will happen ("Refund ₹2,500 to Ravi Patel (order AR-ORD-2026-000123). Access will be revoked."). Deleting, refunding or revoking requires **typing the record's ID or the amount**, and step-up auth when required.

### Forms
- Built with `FormField` + `useZodForm`, using the **same Zod schemas as the API** (`shared/schemas/admin/*`). Client-side errors appear on blur and submit; server `VALIDATION_ERROR` details map back onto the same fields.
- Inline errors under each field (`--adm-danger`, `aria-invalid`, `aria-describedby`), a summary at the top for long forms, and focus moved to the first error.
- Money inputs work in ₹ but submit paise. Date/time inputs are explicitly **IST** (e.g. promotion end "30 Nov 2026, 11:59 PM IST").
- The Markdown editor has a live preview through the public `Markdown` component, so authors see exactly what visitors will see.
- Save buttons show a pending state and stay disabled while submitting; success shows a toast.

## 5. States

| State | Pattern |
|---|---|
| **Loading** (first load) | Skeletons matching the final layout: table rows, KPI cards, drawer fields. No layout shift |
| **Loading** (refetch / page change) | Keep old data, dimmed, with a thin progress bar under the top bar |
| **Empty** (no data yet) | Illustration icon, a one-line explanation, and the primary action if permitted ("No leads yet. They'll appear here when someone submits the contact or callback form.") |
| **Empty** (filters) | "No results for these filters" + Reset filters |
| **Error** (request failed) | Inline `ErrorState` with message, Retry, and the `requestId` (copy button) for support |
| **Error** (permission) | 403 view with an explanation and a link back to the dashboard |
| **Offline** | Banner "You're offline; changes will fail until the connection returns" |
| **Success** | Toast (top right, 4s, `aria-live=polite`); destructive actions get an **Undo** where the API supports it (e.g. lead status) |

## 6. Accessibility

- Keyboard first: visible focus ring (`--adm-accent`), skip link to content, logical tab order, `Esc` closes drawers and modals, focus returns to the trigger.
- Drawers and modals are focus-trapped with `role="dialog"`, `aria-modal` and labelled headings.
- Tables use real `<table>` semantics, `aria-sort` on sortable headers, and labelled row checkboxes.
- Colour contrast is AA in both themes; `prefers-reduced-motion` disables slide animations.
- Shortcuts (P2): `⌘K` search, `g l` go to leads, `/` focus search; listed under a `?` help overlay.

## 7. Motion

Drawers slide 200ms ease-out; toasts fade and slide; skeletons shimmer subtly (disabled under reduced motion). No decorative animation in the admin.

## 8. Branding touches

- Sidebar header: the Alpha Recover mark plus the word "Admin" in brass small caps.
- Login page: a split layout with a pine panel and brand glow on the left and the form on the right; uses the public site's font pairing.
- Favicon badge or title prefix `Admin ·` so the tab is distinguishable from the public site.
- `noindex, nofollow` meta on every admin page.
