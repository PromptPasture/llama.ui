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
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Type information, for the sake of one rule. A promise dropped on the floor
  // takes its rejection with it: the clipboard write that reported a success
  // it had never checked was one, and nothing but the types could have found
  // it.
  {
    files: ['**/*.ts', '**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
]);
