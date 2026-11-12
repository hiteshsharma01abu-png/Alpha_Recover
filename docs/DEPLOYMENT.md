# Alpha Recover — Deployment

**Last reviewed:** 2026-11-12 · Related: [ARCHITECTURE.md](ARCHITECTURE.md) (§3 hosting checklist) · [SECURITY.md](SECURITY.md) · [TESTING.md](TESTING.md) §8 (release validation)

> **Status:** the production host isn't chosen yet. The frontend is temporarily on Vercel; the API has never been deployed. This guide covers both targets the backend is built for: **cPanel with "Setup Node.js App"** and a **VPS**. The automated deploy job is added to CI once the host is known.

---

## 1. What gets deployed

| Piece | Built with | Output | Served by |
|---|---|---|---|
| Frontend | `npm run build` | `dist/` (static files) | Apache/LiteSpeed (cPanel) or Nginx (VPS) |
| API | `npm run build:api` | `dist-server/index.mjs` (+ `migrate.mjs`, `seed.mjs`, `migrations/`) | Node.js 20+ (cPanel Node.js App / Passenger, or PM2) |
| Database | `node dist-server/migrate.mjs`, then `node dist-server/seed.mjs` | schema changes; seed inserts missing catalog rows (never overwrites) | MySQL 8.0+ / MariaDB 10.6+ |
| Scheduled jobs | host cron | — | `curl` → `/api/v1/internal/cron/*` |

The API bundle includes all its dependencies, so the host needs **only Node.js**: no `npm install` on the server.

## 2. Environment variables (API)

Set these in the cPanel Node.js App's environment settings, or in a `chmod 600` `.env` file on a VPS. The full list with descriptions is in [`.env.example`](../.env.example).

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://alpharecover.com` (the public origin; the frontend and API share it) |
| `DATABASE_URL` | `mysql://USER:PASS@localhost:3306/DBNAME` |
| `BETTER_AUTH_SECRET`, `CRON_SECRET`, `IP_HASH_SALT` | each a separate `openssl rand -base64 32`; never reuse between environments |
| `TRUSTED_PROXY_HEADER` | `x-forwarded-for` behind Nginx or a cPanel proxy (check what your host sets) |
| `POSTMARK_SERVER_TOKEN` | required in production (the app refuses to start without it) |
| `EMAIL_FROM` | a sender on the Postmark-verified domain |
| `SENTRY_DSN` | optional |
| `TURNSTILE_SECRET_KEY` | required in production (Cloudflare Turnstile secret for the site) |

**Frontend build variable:** `VITE_TURNSTILE_SITE_KEY` (the public site key) must be set when running `npm run build`, otherwise the forms render without the security check and the API rejects them in production.

## 3. cPanel (shared hosting with Node.js support)

**One-time setup**
1. **MySQL Databases:** create the database and user, and grant all privileges. Keep **Remote MySQL** disabled.
2. **SSL/TLS:** make sure AutoSSL has issued a certificate for the domain.
3. **Setup Node.js App → Create application:**
   - Node.js version: 20 or newer
   - Application mode: Production
   - Application root: e.g. `alpharecover-api` (outside `public_html`)
   - Application URL: `alpharecover.com/api`
   - Application startup file: `index.mjs`
   - Add the environment variables from §2.
4. Upload the frontend `dist/` contents to `public_html/`, and copy [`deploy/htaccess.example`](../deploy/htaccess.example) to `public_html/.htaccess`.
5. **Cron Jobs:** add the two entries from [`deploy/crontab.example`](../deploy/crontab.example), with the domain and `CRON_SECRET` filled in. If the host only allows a 5- or 15-minute interval, emails will wait that long.

**Each release**
1. Build locally or in CI: `npm ci && npm run build && npm run build:api`.
2. Upload `dist-server/` contents to the application root (SFTP/SSH), replacing the old files. Keep the previous copy as `../alpharecover-api.prev` for rollback.
3. Run migrations, then the seed: `node migrate.mjs && node seed.mjs` in the app root (SSH, or the cPanel "Run JS script" option), with `DATABASE_URL` set. The seed only inserts missing rows, so it's safe on every release.
4. Restart the app: **Restart** in Setup Node.js App, or `touch tmp/restart.txt`.
5. Upload the new `dist/` to `public_html/` (keep `.htaccess`).
6. Smoke test (§6).

## 4. VPS (Ubuntu + Nginx + PM2)

**One-time setup**
1. Install Node.js 20+ LTS, Nginx, MySQL 8 (or MariaDB 10.6+), certbot, and PM2 (`npm i -g pm2`).
2. Create the database and user; bind MySQL to `127.0.0.1`; enable the firewall (allow 22, 80, 443 only).
3. Releases live in `/var/www/alpharecover/releases/<timestamp>/` with a `current` symlink.
4. Nginx: adapt [`deploy/nginx.conf.example`](../deploy/nginx.conf.example); run `certbot --nginx`.
5. Start the API: `pm2 start /var/www/alpharecover/current/dist-server/index.mjs --name alpharecover-api --env-file /var/www/alpharecover/.env`, then `pm2 save && pm2 startup`.
6. Cron: `crontab -e` with [`deploy/crontab.example`](../deploy/crontab.example). Optionally enable MySQL binary logs for point-in-time recovery.

**Each release**
1. Upload the build to a new `releases/<timestamp>/` directory (`dist/` + `dist-server/`).
2. `node releases/<timestamp>/dist-server/migrate.mjs && node releases/<timestamp>/dist-server/seed.mjs`.
3. Point `current` at the new release; `pm2 reload alpharecover-api`.
4. Smoke test (§6).

## 5. Migrations policy

- Generate SQL from schema changes with `npm run db:generate`, review it, and commit it with the code.
- **Expand/contract only:** add new columns/tables first, backfill, switch the code, and drop the old ones in a *later* release. That keeps rollback safe (the previous app version still works with the new schema).
- Migrations run before the new app version starts.

## 6. Smoke test after every release

```bash
curl -fsS https://alpharecover.com/api/v1/health          # {"data":{"status":"ok","db":"ok",...}}
curl -fsS https://alpharecover.com/api/v1/auth/session    # {"data":{"user":null}}
curl -fsSI https://alpharecover.com/training/logical | head -1   # 200 (SPA fallback works)
```
Then watch Sentry and the app log for 30 minutes.

## 7. Rollback

- **cPanel:** restore the previous `alpharecover-api.prev` contents, restart the app, and re-upload the previous `dist/`.
- **VPS:** point `current` back at the previous release, then `pm2 reload alpharecover-api`.
- Schema changes stay (expand/contract keeps them compatible). For data problems, restore the latest `mysqldump` into a scratch database, verify it, then switch.

## 8. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| App won't start; log says `Invalid environment configuration` | A required variable is missing or too short; the message lists each one |
| `/api/v1/health` returns 503 | Wrong `DATABASE_URL`, MySQL down, or the user lacks privileges |
| Every route returns `index.html`, even `/api/...` | `.htaccess` is missing the `RewriteRule ^api/ - [L]` line, or the Node app URL isn't `/api` |
| POST requests get 403 "Cross-origin request rejected" | `APP_URL` doesn't match the site's real origin (`https://` vs `http://`, `www` vs bare domain) |
| Emails never arrive | Cron isn't running (check `notification_jobs.status = 'pending'`), `POSTMARK_SERVER_TOKEN` is wrong, or the sender domain isn't verified in Postmark |
| Jobs stuck in `dead` | Read `notification_jobs.last_error`; fix the cause, then reset `status = 'pending', attempts = 0` |
| All users appear to share one IP (rate limits trip for everyone) | Set `TRUSTED_PROXY_HEADER` to the header your host's proxy adds |
| Changes not visible after upload (cPanel) | Restart the Node.js app (`touch tmp/restart.txt`) |
