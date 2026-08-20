import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist/**', 'storybook-static/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // tsc (noUnusedLocals/noUnusedParameters) y las libs DOM cubren esto en TS
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];