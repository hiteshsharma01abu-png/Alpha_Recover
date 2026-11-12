# Alpha Recover — Backend Project Audit

> **Archived snapshot — not maintained.** Reflects the repository on 2026-11-12. File names it mentions have since changed: `BACKEND_IMPLEMENTATION_PRD.md` → [PRD.md](../PRD.md), `BACKEND_DATABASE_SCHEMA.md` → [DATABASE.md](../DATABASE.md), `BACKEND_API_SPECIFICATION.md` → [API.md](../API.md), `BACKEND_SECURITY_AND_PERMISSIONS.md` → [SECURITY.md](../SECURITY.md), `BACKEND_QA_AND_TESTING_PLAN.md` → [TESTING.md](../TESTING.md), `BACKEND_IMPLEMENTATION_PLAN.md` → [PLAN.md](../PLAN.md); `docs/backend/` → `docs/`.

**Date:** 2026-11-12
**Scope:** Full repository inspection (`main` @ `b337bf9`), every route, component, form, CTA and data source.
**Method:** Source read of all 57 files under `src/`, config files, build/deploy config, git history. Production build and lint run to confirm health.

> **Bottom line:** Alpha Recover is a **frontend-only** Vite + React SPA. **No backend exists** — no API layer, no database, no auth, no payments, no email, no server code of any kind. Every form and purchase button is a UI stub that shows an `alert()` or a placeholder message. All content is hard-coded in `src/data/content.ts`. There is **no student portal, lesson player, or admin panel UI** yet.

---

## 1. Project architecture

| Area | Finding |
|---|---|
| Framework | Vite 8, React 19, TypeScript 6 (strict-ish: `noUnusedLocals`, `verbatimModuleSyntax`, `erasableSyntaxOnly`) |
| Routing | React Router 7, `BrowserRouter`, all routes declared in `src/App.tsx`, nested under `<Layout/>`; unknown paths redirect to `/` |
| Runtime deps | `react`, `react-dom`, `react-router-dom` only |
| Styling | Plain CSS with design tokens in `src/styles/global.css`; one CSS file per section/page |
| State management | Local `useState` only. No context, store, React Query, or SWR |
| API service layer | **None.** Zero `fetch`/axios calls anywhere in `src/` |
| Backend files | **None.** No `api/`, `server/`, `supabase/`, `prisma/`, functions, or SQL |
| Environment config | `.env.local` holds only `VERCEL_OIDC_TOKEN` (written by Vercel CLI). No `VITE_*` vars, no API base URL |
| Lint / typecheck | `oxlint` (11 pre-existing warnings, 0 errors); `tsc -b` passes |
| Build | `tsc -b && vite build` → static `dist/` (≈107 KB JS gzip, ≈21 KB CSS gzip) |
| Deployment | Vercel project `recova`, static SPA with catch-all rewrite to `/index.html` (`vercel.json`). Live: https://recova-sand.vercel.app. **Temporary:** production hosting is undecided (shared cPanel or VPS likely), so the backend plan is host-portable |
| Source control | Git, remote `github.com/hiteshsharma01abu-png/Alpha_Recover`, 2 commits |
| Docs | `README.md`, `CLAUDE.md`. No prior docs folder — this folder (`docs/backend/`) is new |
| Tests | None |

### Folder structure

```
src/
  main.tsx, App.tsx
  components/
    layout/    Layout, Header, Footer, ScrollToTop, RouteScrollReset, WhatsAppFloat
    sections/  ContactCtaSection, DemoVideosSection, ProTrainingSection,
               ProfessionalPlanSection, SolutionsStack, TrainingSolutionsSection, TrainingExplorer
    visuals/   demoVisuals, impactVisuals, pricingVisuals, proTrainingVisuals, PageHddVisual (unused)
    ui/        Reveal
  pages/       Home, TrainingIndex, TrainingTrack, Pricing, Demos, Contact, Account,
               About, Services, Industries, Blog, BlogPost, VerifyCertificate
  data/        content.ts (all copy + data), sectionMedia.ts (image maps)
  lib/         icons.ts (local SVG icon resolver)
  styles/      global.css, glass.css, sections.css
public/        assets/ (webp/png images), icons/ (pre-exported SVGs)
```

---

## 2. Routes and pages

| Route | Page | Content source | Interactive elements | Backend touchpoints |
|---|---|---|---|---|
| `/` | Home | `content.ts` (stats, heroHighlights, quickActions, recoverySolutions, featuredSolutions, demoVideos, whyLearn, pricing, company) | Hero CTAs → `/pricing`, `/demos`; quick-action cards → `/training/:id`; Solutions stack cards; Training explorer (tabs); Pro training cards; Demo video cards (play → alert); Professional Plan (Buy Now → `/pricing`, Ask on WhatsApp, fake countdown); Contact CTA form | Plans/pricing, promotion countdown, demo videos, courses, callback lead |
| `/training` | TrainingIndex | `trainingTracks`, `featuredSolutions` | TrainingExplorer (track tabs → module accordion → lesson links), Pro training cards | Course catalog |
| `/training/:trackId` | TrainingTrack | `trainingTracks` | Lesson buttons → `alert('Lesson player unlocks after purchase + auth…')`; CTAs → `/pricing`, `/account` | Course detail, **lesson access control, video playback, progress** |
| `/pricing` | Pricing | `pricing`, `company` | Professional Plan in `buyMode="checkout"`: **Buy Now → `alert('Checkout will connect…')`**, Ask on WhatsApp, countdown, mobile "show more features" toggle | **Checkout, orders, payments, enrollment** |
| `/demos` | Demos | `demoVideos`, `demoCategoryFilters` | Category filter tabs, search box, featured video, video cards (play → alert), pagination (12/page, client-side), CTA → `/training`, `/#pricing` | Demo video catalog, search/filter, playback, view counts |
| `/contact` | Contact | `company` | Contact form (name, email, phone, reason select, message, WhatsApp/SMS consent) → shows "Message captured in the UI…" | **Lead/inquiry submission, notifications** |
| `/account` | Account | `company` | Login/Register tabs; login form; "Lost your password?" → note; register form (first name, email, country, phone, password ×2, terms) | **Registration, login, password reset, sessions** |
| `/about` | About | static JSX | CTA → `/contact` | — (static) |
| `/services` | Services | `services` | "Request service" links → `/contact` | Service inquiry lead (via contact form) |
| `/industries` | Industries | `industries` | none | — (static) |
| `/blog` | Blog | `blogPosts` (3 posts, excerpt only) | "Read article" → `/blog/:slug` | Blog CMS |
| `/blog/:slug` | BlogPost | `blogPosts` | none; placeholder body text "Full CMS content will load from your database…" | Blog CMS (full article body) |
| `/verify-certificate` | VerifyCertificate | — | Certificate ID form → "Certificate lookup needs a certificates table + API." | **Certificate verification** |

### Global layout (every page)

| Component | Elements | Backend touchpoints |
|---|---|---|
| Header | Desktop nav + "More" dropdown (Blog, Services, Verify Certificate, Industries), Training dropdown (all 9 tracks), `/account` CTA; mobile drawer with same links | Training dropdown could read course list; account CTA should reflect login state |
| Footer | Contact info (mailto/tel), quick links, services list, WhatsApp button, "Request Callback" → `/contact`, social links, legal links | Settings (contact details, social links). **Social links are placeholders** (`https://youtube.com`, etc.). **Privacy Policy / Terms link to `/about`** — no legal pages exist |
| WhatsAppFloat | Floating `wa.me/916355197917` link | None (client link) |
| ScrollToTop / RouteScrollReset | UX helpers | None |

---

## 3. Forms and inputs (all non-functional)

| Form | Location | Fields | Current validation | Current behaviour |
|---|---|---|---|---|
| Login | `pages/Account.tsx` | email (`type="text"`, `inputMode="email"`), password, "Remember me" checkbox (unbound) | HTML `required` only; **no email format check** | Sets note "Login UI ready — auth needs a backend" |
| Forgot password | `pages/Account.tsx` | button only | — | Note "Password reset email flow needs backend mailer." No reset page/route exists |
| Register | `pages/Account.tsx` | first name, email, country (India/US/UK/UAE/Other), phone (optional), password, confirm password, terms checkbox | `required`; passwords-match check; **no email format, password strength, or phone validation** | Note "Registration UI ready…" |
| Contact | `pages/Contact.tsx` | name, email, phone (required), reason (Technical Support / Software-hardware sale / Data Recovery services / Training / Other), message, WhatsApp/SMS consent checkbox | `required` only; uncontrolled inputs; **consent checkbox has no `name` — value is not captured** | Shows "Message captured in the UI…" |
| Request callback | `components/sections/ContactCtaSection.tsx` (Home, `/contact`) | email only | `required` | `alert('Thanks — backend wiring comes next…')`. **Note:** a "callback" form that collects only email — phone is likely needed (product decision) |
| Verify certificate | `pages/VerifyCertificate.tsx` | certificate ID (e.g. `AR-2026-00421`) | `required`, trim | Echoes the code back |
| Demo search | `pages/Demos.tsx` | search text | none | Client-side filter over 6 static videos |

---

## 4. Static / dummy data inventory

| Data | Location | Shape | Notes |
|---|---|---|---|
| Company | `content.ts` `company` | name, email, phone, WhatsApp, address, hours, CIN/GST ("Pending") | Should become site settings |
| Stats | `content.ts` `stats` | 6 marketing counters (10K+ trainees etc.) | Marketing copy; fine to keep static |
| Training tracks | `content.ts` `trainingTracks` | 9 tracks → 21 modules → **117 lessons** (id + title only) | No video, duration, description, or preview flag per lesson |
| Featured solutions | `content.ts` | 3 cards linking to tracks | |
| Demo videos | `content.ts` `demoVideos` | 6 items: title, tag, category, duration, tags, description, level, **views (string)**, **uploaded (relative string)**, featured | Thumbnails are **hot-linked Unsplash URLs** (`demoVisuals.tsx`); no video URL at all |
| Demo filter counts | `content.ts` `demoCategoryFilters` | hard-coded counts (24/8/6/4/6) | Do not match the 6 actual videos; page recomputes some counts locally |
| Pricing | `content.ts` `pricing` | one plan "Professional Plan", was ₹5,999, now ₹2,500, INR, sale label, 17 features | Single plan; no plan ID |
| Countdown | `ProfessionalPlanSection.tsx` `Countdown` | `Date.now() + 52h18m40s` | **Fake — resets on every page load.** Needs a real promotion end date |
| Services | `content.ts` | 9 strings | Static |
| Industries | `content.ts` | 6 cards | Static |
| Blog posts | `content.ts` `blogPosts` | 3 posts: slug, title, excerpt, date | **No article body** |
| Why learn | `content.ts` | 6 audience cards | Static |
| Images | `public/assets/`, `sectionMedia.ts` | local webp | Static |

---

## 5. UI patterns present

- **Tabs:** Account login/register toggle; TrainingExplorer track tabs; Demos category filters.
- **Accordion:** TrainingExplorer modules → lessons.
- **Dropdowns:** Header "More" and "Training" menus.
- **Drawer:** Mobile navigation drawer.
- **Pagination:** Demos page (client-side, 12 per page).
- **Show more toggle:** Pricing features on narrow screens.
- **Modals:** none.
- **Responsive:** extensive breakpoints (390–1600px); sticky stacked cards on mobile/tablet.

**Not present in the UI (must be built as frontend work before the corresponding backend is usable):**
- Student dashboard / "My courses" / progress view (Account page advertises "Continue Learning", "Track Progress").
- Lesson/video player page.
- Checkout success / failure pages.
- Password reset page (token entry + new password), email verification landing.
- Profile/settings page, order history, certificate download.
- Admin panel (any screen).
- Legal pages (Privacy Policy, Terms, Refund Policy) — **required by Razorpay for merchant activation**.

---

## 6. Backend status

### Implemented
**Nothing.** There is no backend functionality of any kind.

### Partially implemented
None on the backend. On the frontend, these UIs exist and only need wiring:
- Login and register forms (fields exist; validation incomplete).
- Contact form and callback form.
- Certificate verification form.
- Pricing / Buy Now button (on `/pricing`).
- Demo video catalog with filter/search/pagination (client-side over static data).
- Course catalog and track pages (static data).

### Completely missing

| Capability | Evidence |
|---|---|
| Authentication (register, login, logout, sessions, password reset, email verification) | Account page notes; no auth code |
| Student portal (dashboard, enrolled courses, progress) | No UI or API |
| Lesson access control + video delivery | Lesson buttons alert; no video URLs exist |
| Course/lesson management | Static `trainingTracks` |
| Checkout, orders, payment gateway, webhooks | Buy Now alert mentions "Razorpay / Stripe" |
| Enrollment activation after payment | — |
| Promotions / sale countdown | Fake client countdown |
| Leads / inquiries capture + notification | Contact + CTA forms discard data |
| Email sending (transactional) | "needs backend mailer" |
| WhatsApp messaging (beyond `wa.me` links) | Consent checkbox exists but isn't captured |
| Certificates (issue, PDF, verify) | Verify page stub |
| Blog CMS (article bodies) | BlogPost placeholder text |
| Demo video hosting, playback, view counts | Play buttons alert; Unsplash thumbnails |
| Admin panel (all modules) | None |
| Site settings (contact info, social links) | Hard-coded |
| Rate limiting, captcha, audit logging, monitoring | None |

### Missing APIs (summary)
Auth, account/profile, course catalog, lesson access + playback token, progress, plans/promotions, checkout/order, payment webhook, enrollments, leads, demo videos (+ view tracking), blog, certificates (verify + issue + download), site settings, and the full admin surface. See `BACKEND_API_SPECIFICATION.md`.

### Missing business logic
- Who can watch which lesson (enrollment check, preview lessons).
- Price resolution (base price vs active promotion, server-side, never trusted from client).
- Payment verification (Razorpay signature + webhook idempotency) and enrollment activation.
- Certificate eligibility ("Certificate issued after course completion criteria are met" — criteria undefined).
- Lead routing and follow-up workflow.
- Account-sharing protection for a lifetime-access product (session/device limits).

---

## 7. Issues noticed during the audit (frontend, not changed)

| # | Issue | Impact |
|---|---|---|
| 1 | Countdown resets on every load | Misleading urgency; replace with server `ends_at` |
| 2 | Email inputs use `type="text"` with no format validation | Bad data in leads/users; backend must validate regardless |
| 3 | Contact consent checkbox has no `name` | Consent can't be recorded — needed for WhatsApp/SMS compliance |
| 4 | Callback form collects email, not phone | Callback can't be actioned without a phone number |
| 5 | Privacy/Terms links point to `/about` and `/` | No legal pages; payment gateway activation needs them |
| 6 | Social links are generic placeholders | Cosmetic |
| 7 | Demo thumbnails hot-link Unsplash | Licensing/availability risk; move to own storage |
| 8 | Demo filter counts hard-coded and inconsistent | Should come from API |
| 9 | Blog is client-rendered SPA | Weak SEO for articles; consider prerendering (see plan) |
| 10 | "Hard disk firmware repairing software access" is a sold feature | Needs a defined delivery mechanism (download, licence key) — business decision |
