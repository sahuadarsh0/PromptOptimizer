
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = command === 'build';

  return {
    // Only use the repo name sub-path for production builds (GitHub Pages)
    // For local dev, use root '/'
    base: isProduction ? '/prompt-optimizer/' : '/', 
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || process.env.API_KEY)
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      target: 'esnext'
    }
  };
});
