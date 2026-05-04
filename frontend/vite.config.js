import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/trakt-images': {
        target: 'https://media.trakt.tv',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/trakt-images/, '')
      }
    }
  }
})
