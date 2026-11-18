/**
 * Vercel function entry (temporary staging, docs/DEPLOYMENT.md §9). Bundled into
 * .vercel/output/functions/api.func by scripts/build-vercel.mjs; every /api/* request lands here.
 */
import { getRequestListener } from '@hono/node-server';
import { bootstrap } from './bootstrap';

// Vercel sets x-real-ip to the client address; without it every visitor would share one rate-limit bucket.
process.env.TRUSTED_PROXY_HEADER ||= 'x-real-ip';

// Built once per function instance and reused across requests (keeps the MySQL pool warm).
const { app } = bootstrap();

export default getRequestListener(app.fetch);
