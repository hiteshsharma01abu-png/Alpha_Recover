// Pre-renders the public pages to static HTML after `vite build` (docs/ARCHITECTURE.md §5.1):
//   dist/index.html, dist/pricing/index.html, dist/training/<id>/index.html, …  ← real markup + per-page head tags
//   dist/app.html     ← the empty shell for client-only routes (dashboard, account, admin, lessons, unknown paths)
//   dist/sitemap.xml, dist/robots.txt
// The browser hydrates the pre-rendered markup (src/main.tsx). Page list and head data: src/data/seo.ts.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

const dist = 'dist';
const ssrOut = 'node_modules/.cache/prerender';

await rm(ssrOut, { recursive: true, force: true });
await build({
  logLevel: 'warn',
  build: { ssr: 'src/entry-server.ts', outDir: ssrOut, emptyOutDir: true, copyPublicDir: false, rollupOptions: { output: { entryFileNames: 'entry-server.mjs' } } },
});
const { render, pageSeo, headTags, prerenderPaths, SITE_URL } = await import(pathToFileURL(path.resolve(ssrOut, 'entry-server.mjs')).href);

const template = await readFile(path.join(dist, 'index.html'), 'utf8');
if (!template.includes('<div id="root"></div>')) throw new Error('dist/index.html has no empty <div id="root"></div>; run vite build first');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The template with its default title/description replaced by this page's head tags. */
function page(seo, body, { home = false } = {}) {
  const tags = headTags(seo);
  const head = [
    `<title>${esc(tags.title)}</title>`,
    ...tags.meta.map((m) => ('name' in m ? `<meta name="${esc(m.name)}" content="${esc(m.content)}" />` : `<meta property="${esc(m.property)}" content="${esc(m.content)}" />`)),
    tags.canonical ? `<link rel="canonical" href="${esc(tags.canonical)}" />` : '',
    // JSON can't break out of the script element once "<" is escaped
    tags.jsonLd ? `<script type="application/ld+json">${JSON.stringify(tags.jsonLd).replace(/</g, '\\u003c')}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
  let html = template
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  if (home) {
    // Layout.tsx sets this after hydration; setting it in the HTML avoids a flash of the inner-page button style
    html = html.replace('<html lang="en">', '<html lang="en" data-home>');
  } else {
    // The hero image preloads in index.html are for the homepage only
    html = html.replace(/\s*<link rel="preload" as="image"[^>]*>/g, '');
  }
  return html;
}

// Client-only routes: same head defaults, never indexed, nothing to hydrate
await writeFile(path.join(dist, 'app.html'), page(pageSeo('/account'), ''));

const paths = prerenderPaths();
for (const url of paths) {
  // React adds a preload <link> for every eagerly loaded image; they would compete with the hero image, and hydration skips them
  const body = render(url).replace(/<link rel="preload" as="image"[^>]*\/>/g, '');
  if (!body) throw new Error(`Pre-render of ${url} produced no markup`);
  const file = url === '/' ? path.join(dist, 'index.html') : path.join(dist, url, 'index.html');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, page(pageSeo(url), body, { home: url === '/' }));
}

const today = new Date().toISOString().slice(0, 10);
const indexable = paths.filter((p) => !pageSeo(p).noindex);
await writeFile(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable
    .map((p) => `  <url><loc>${esc(SITE_URL + (p === '/' ? '/' : p))}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
);
await writeFile(
  path.join(dist, 'robots.txt'),
  ['User-agent: *', 'Disallow: /admin', 'Disallow: /account', 'Disallow: /dashboard', 'Disallow: /checkout/', 'Disallow: /learn/', 'Disallow: /api/', '', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join('\n'),
);

await rm(ssrOut, { recursive: true, force: true });
console.log(`pre-rendered ${paths.length} pages + app.html, sitemap.xml (${indexable.length} URLs), robots.txt`);
