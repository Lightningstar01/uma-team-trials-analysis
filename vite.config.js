import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from /<repo>/, not the domain root.
  base: '/uma-team-trials-analysis/',
  plugins: [react()],
})
