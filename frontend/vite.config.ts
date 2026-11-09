/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In docker-compose the backend is reachable as http://backend:8000.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Polling is needed for HMR when sources are bind-mounted into docker.
    watch: process.env.VITE_USE_POLLING ? { usePolling: true, interval: 300 } : null,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Pure logic runs in Node; component tests opt into jsdom with a
    // `// @vitest-environment jsdom` comment at the top of the file.
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      // Pure domain logic must be fully covered (PLAN, stage 2). The rest of
      // the app is measured too, but only domain/ has a hard gate.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/api/schema.ts', 'src/main.tsx'],
      reporter: ['text', 'html'],
      thresholds: {
        'src/domain/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
