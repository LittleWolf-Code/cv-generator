import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The dev server is started by scripts/dev.ts, which adds the /api proxy and injects the
// X-CV-Token into the page (NF-01). No external resource is loaded at runtime.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', emptyOutDir: true },
});
