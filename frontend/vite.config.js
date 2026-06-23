import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/multiply-agent-frontend/',
  preview: {
    allowedHosts: ['lobster-app-9qdmi.ondigitalocean.app'],
  },
  server: {
    allowedHosts: ['lobster-app-9qdmi.ondigitalocean.app'],
  }
})