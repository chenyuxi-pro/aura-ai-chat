import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['es'],
            fileName: 'aura-widget',
        },
        rollupOptions: {
            external: ['lit', 'marked', 'dompurify'],
        },
        outDir: 'dist',
        sourcemap: true,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    server: {
        port: 5178,
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
});
