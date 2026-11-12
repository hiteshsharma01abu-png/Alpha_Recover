import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin API in development: `npm run dev:api` serves it on :8787
    proxy: { '/api': 'http://localhost:8787' },
  },
})
