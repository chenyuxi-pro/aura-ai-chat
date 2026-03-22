import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.includes('-')
        }
      }
    })
  ],
  server: {
    port: 4400,
    strictPort: true,
    proxy: {
      '/github-api': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-api/, ''),
      },
      '/github-copilot-api': {
        target: 'https://api.githubcopilot.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-copilot-api/, ''),
      },
      '/github-copilot-individual-api': {
        target: 'https://api.individual.githubcopilot.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-copilot-individual-api/, ''),
      },
      '/github': {
        target: 'https://github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github/, ''),
      },
    },
  },
})
