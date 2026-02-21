import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.ts',
            formats: ['es', 'cjs'],
            fileName: 'aura-ai-chat',
        },
        rollupOptions: {
            external: ['lit', 'marked', 'dompurify'],
        },
        outDir: 'dist',
        sourcemap: true,
    },
    plugins: [
        dts({
            insertTypesEntry: true,   // creates index.d.ts entry point
            outDir: 'dist/types',
        })
    ],
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
