import { existsSync } from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** `vite preview` routes like production: pre-rendered pages get their own HTML, other paths the empty app.html shell. */
const previewRouting = (): Plugin => ({
  name: 'preview-prerender-routing',
  configurePreviewServer(server) {
    const dist = path.resolve(server.config.root, server.config.build.outDir)
    server.middlewares.use((req, _res, next) => {
      const pathname = (req.url ?? '/').split('?')[0]
      if (pathname.startsWith('/api') || path.extname(pathname)) return next()
      const page = path.join(dist, pathname, 'index.html')
      req.url = existsSync(page) ? path.posix.join(pathname, 'index.html') : '/app.html'
      next()
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), previewRouting()],
  server: {
    // Same-origin API in development: `npm run dev:api` serves it on :8787
    proxy: { '/api': 'http://localhost:8787' },
  },
})
