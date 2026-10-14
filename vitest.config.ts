import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => path.join(root, p, 'src', 'index.ts');
// Same local settings as npm run dev, the MCP server and the scripts (POPPLER_BIN: pdftotext in the ATS checks).
if (existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));

export default defineConfig({
  resolve: {
    // Tests run on the TypeScript sources: no build needed.
    alias: {
      '@cv/core': src('packages/core'),
      '@cv/store': src('packages/store'),
      '@cv/render': src('packages/render'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/server/test/**/*.test.ts', 'apps/mcp/test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
  },
});
