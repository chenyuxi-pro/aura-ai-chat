import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(({ command }) => ({
    root: command === 'serve' ? './playground' : undefined,
    build: {
        lib: {
            entry: 'src/index.ts',
            formats: ['es', 'cjs'],
            fileName: 'index',
        },
        rollupOptions: {
            // Keep Lit (and its subpath imports) external so all directives/runtime
            // resolve to the same instance in host apps (avoids directive mismatches).
            external: [
                /^lit(\/.*)?$/,
                /^lit-html(\/.*)?$/,
                /^@lit\/.*/,
                'marked',
                'dompurify',
            ],
        },
        outDir: 'dist',
        sourcemap: true,
    },
    plugins: [
        dts({
            outDir: 'dist',
        })
    ],
    server: {
        port: 4000,
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
}));
