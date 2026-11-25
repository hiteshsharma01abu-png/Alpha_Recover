# Alpha Recovery — Website asset implementation

## Read this first (Cursor / Claude Code)
Scope: replace only the six illustrations in the existing audience/benefits card section shown on the Alpha Recovery website. Do not redesign the cards or change unrelated sections.

## Asset mapping
| Existing card heading | Preferred asset |
|---|---|
| For cybersecurity experts | 01-cybersecurity-experts.webp |
| For photographers | 02-photographers.webp |
| For IT careers | 03-it-careers.webp |
| Online advantages | 04-online-advantages.webp |
| Protect personal assets | 05-protect-personal-assets.webp |
| For computer institutes | 06-computer-institutes.webp |

Each asset also has a PNG version with the same basename. Prefer WebP for production; keep PNG as an optional source/fallback. Do not load both formats unnecessarily.

## Implementation
1. Inspect the repository, existing card component, asset conventions, styling tokens and project instructions before editing. Locate cards by their headings, not guessed file paths.
2. Copy the assets into the existing project asset directory using its established import or public URL conventions. Update only the six image references.
3. Preserve the existing dark green theme, typography, copy, icons, card layout, borders, spacing, breakpoints, links, functionality and API routes. Do not alter pricing, authentication or payment logic.
4. Preserve transparency. Use object-fit: contain (or equivalent), maintain aspect ratio and avoid cropping, opaque backgrounds, masks or unnecessary glow effects. Keep the images inside their existing illustration area without overlapping text or icons. Adjust image-specific sizing only if needed.
5. Use the project's existing image component and optimization strategy. Provide empty alt text for decorative images when adjacent card text already conveys their meaning; otherwise use concise descriptive alt text. Reserve image space to avoid layout shift; lazy-load if below the fold.
6. Verify desktop (1440px), tablet (768px), and mobile (390px and 320px). Check all six assets load, correct mapping, transparent edges on dark backgrounds, readability, no overflow or layout shifts, and unchanged interactions. Run existing lint, typecheck, build and relevant tests if available.
7. Update relevant existing project documentation and changelog with changed files, asset mapping, checks performed and any limitations. Do not invent test results. Avoid unrelated refactors; report any blockers to the human reviewer.

## Acceptance criteria
- Six distinct illustrations appear in the correct cards.
- Existing UI and behavior remain intact.
- No new dependencies, API changes or unrelated edits.
- Human reviewer receives changed-file list and desktop/mobile verification results.

Repository paths and exact component names are intentionally unspecified because the repository was not inspected when preparing this package.
