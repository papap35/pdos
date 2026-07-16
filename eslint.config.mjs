import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**'],
  },
  {
    files: ['app.js', 'lib/pure.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        module: 'readonly',
        score: 'readonly',
        esc: 'readonly',
        formatDate: 'readonly',
        isValidData: 'readonly',
        migrateActionGoals: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { ignoreRestSiblings: true }],
      'no-undef': 'error',
    },
  },
  {
    files: ['lib/**/*.test.js', 'vitest.config.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
];
