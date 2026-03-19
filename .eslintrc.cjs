// @ts-check
'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // Allow explicit `any` — codebase uses it intentionally in many places
    '@typescript-eslint/no-explicit-any': 'off',
    // Allow unused vars prefixed with _ (common pattern in this codebase)
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Allow require() in .cjs files
    '@typescript-eslint/no-var-requires': 'off',
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.d.ts',
  ],
};
