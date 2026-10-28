import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path: "/" locally, "/<repo>/" on GitHub Pages (set by CI via VITE_BASE).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // Превью-хосты вида *.e2b.app и любые внешние домены.
    allowedHosts: true,
  },
  preview: { host: '0.0.0.0', allowedHosts: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
})
