import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  root: 'src/renderer',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src/renderer', import.meta.url)), '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)) } },
  // Keep the browser client on a different port from Electron's renderer
  // (5173), so both development modes can run at the same time.
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/api': 'http://localhost:3001' }
  },
  build: { outDir: '../../dist-web', emptyOutDir: true }
})
