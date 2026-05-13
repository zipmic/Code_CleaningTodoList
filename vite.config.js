import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use base: './' for FTP hosting or root-level GitHub Pages (username.github.io).
// For GitHub Pages under a repo path (username.github.io/repo-name/),
// change base to '/repo-name/' — e.g. base: '/cleanup-quest/'
export default defineConfig({
  plugins: [react()],
  base: './',
})
