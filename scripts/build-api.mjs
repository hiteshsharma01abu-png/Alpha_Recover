// Production bundle for the API: `npm run build:api` → dist-server/
// Everything (including node_modules) is bundled, so the host needs only Node.js 20+ — no npm install.
import { build } from 'esbuild';
import { cp, rm } from 'node:fs/promises';

await rm('dist-server', { recursive: true, force: true });

await build({
  entryPoints: { index: 'server/index.ts', migrate: 'server/db/migrate.ts', seed: 'server/db/seed.ts' },
  outdir: 'dist-server',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  legalComments: 'none',
  // Some CommonJS dependencies call require(); give the ESM bundle a real one.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'info',
});

await cp('server/db/migrations', 'dist-server/migrations', { recursive: true });
console.log('dist-server/ ready: index.mjs (API), migrate.mjs (migrations), seed.mjs (catalog, plans, demo videos, blog, settings)');
