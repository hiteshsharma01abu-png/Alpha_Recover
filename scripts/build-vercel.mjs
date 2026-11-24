// Vercel staging build (docs/DEPLOYMENT.md §9): runs after `npm run build` on Vercel.
// Writes the Build Output API layout (https://vercel.com/docs/build-output-api/v3):
//   static/              ← dist/ (the website)
//   functions/api.func/  ← the whole API bundled into one Node function
//   config.json          ← routing: real files first, /api/* → the function, pre-rendered pages → their
//                           index.html (scripts/prerender.mjs), everything else → app.html (the empty shell)
// Usage: node scripts/build-vercel.mjs [outDir]   (default .vercel/output; pass a scratch dir to inspect locally)
import { build } from 'esbuild';
import { cp, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = process.argv[2] ?? '.vercel/output';
const fn = path.join(out, 'functions/api.func');

await rm(out, { recursive: true, force: true });
await cp('dist', path.join(out, 'static'), { recursive: true });

await build({
  entryPoints: ['server/vercel.ts'],
  outfile: path.join(fn, 'index.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  legalComments: 'none',
  // Some CommonJS dependencies call require(); give the ESM bundle a real one (same as build-api.mjs).
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'warning',
});

await writeFile(
  path.join(fn, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30 }, null, 2),
);

// dist/pricing/index.html → serve it for /pricing and /pricing/
const prerendered = (await readdir('dist', { recursive: true }))
  .filter((f) => f.endsWith('index.html') && !f.startsWith('assets'))
  .map((f) => '/' + f.split(path.sep).slice(0, -1).join('/'));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const immutable = { 'Cache-Control': 'public, max-age=31536000, immutable' };
await writeFile(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Only Vite's hashed bundles are immutable; public/assets/ images, icons and favicons keep normal caching.
        { src: '^/assets/[^/]+-[A-Za-z0-9_-]{8}\\.(js|css)$', headers: immutable, continue: true },
        { handle: 'filesystem' },
        { src: '^/api(/.*)?$', dest: '/api' },
        ...prerendered.map((p) => ({ src: p === '/' ? '^/$' : `^${escapeRe(p)}/?$`, dest: p === '/' ? '/index.html' : `${p}/index.html` })),
        { src: '^/(.*)$', dest: '/app.html' },
      ],
    },
    null,
    2,
  ),
);

console.log(`${out}/ ready: static site + api function`);
