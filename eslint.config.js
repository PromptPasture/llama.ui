import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default defineConfig([
  // `_react` is the pre-migration app, kept for reference and linted by its own config.
  globalIgnores(['build/', '.svelte-kit/', 'node_modules/', 'static/', '_react/']),

  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,

  // Formatting is prettier's job; these turn off the rules that would fight it.
  prettier,
  svelte.configs.prettier,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.svelte'],
        svelteConfig,
      },
    },
  },
]);
