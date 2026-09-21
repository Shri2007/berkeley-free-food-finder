import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In dev, forward /api/* to the Express server so the browser only ever talks to :5173.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
