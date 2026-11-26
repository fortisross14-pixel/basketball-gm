import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works at any path (e.g. GitHub Pages /basketball-gm/).
// The app uses hash routing, so no server-side rewrites are needed.
export default defineConfig({
  base: './',
  plugins: [react()],
})
