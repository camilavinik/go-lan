import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: API_TARGET, ws: true },
      '/healthz': { target: API_TARGET },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
