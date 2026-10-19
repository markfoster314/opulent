import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // The .env file lives at the monorepo root, not next to this config. Without
  // this, Vite looks only in apps/web, finds nothing, and every VITE_ variable
  // silently becomes undefined. Relative to the Vite project root.
  envDir: '../../',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules/ }],
        },
      },
    },
  },
});
