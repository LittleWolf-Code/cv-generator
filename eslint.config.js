import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/dist/**', '**/node_modules/**', 'out/**', 'data/**', 'import/**', 'coverage/**', '**/.spike/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  { files: ['apps/web/src/**/*.{ts,tsx}'], languageOptions: { globals: { ...globals.browser } } },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      // ATS-01: rasterizing HTML-to-PDF libraries are forbidden.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'html2pdf.js', message: 'ATS-01 : html2pdf.js est interdit (PDF sans couche texte).' },
            { name: 'html2canvas', message: 'ATS-01 : html2canvas est interdit (rasterisation).' },
          ],
        },
      ],
    },
  },
  {
    // §7.6: stdout belongs to the MCP protocol; logs go to stderr only.
    files: ['apps/mcp/**/*.ts', 'packages/*/src/**/*.ts'],
    rules: { 'no-console': ['error', { allow: ['error'] }] },
  },
);
