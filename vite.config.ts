import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        // Use relative base path so assets load correctly on GitHub Pages (subdirectories)
        base: './',
        define: {
            // If VITE_API_KEY is not set, default to empty string to prevent build errors
            // and ensure the app falls back to LocalStorage/Modal (BYOK) logic.
            'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || '')
        },
        build: {
            outDir: 'dist',
            assetsDir: 'assets',
            target: 'esnext'
        }
    };
});