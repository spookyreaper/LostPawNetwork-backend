const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**', '.tmp/**', '.data/**', 'data/**', '.local/**',
      'logs/**', 'coverage/**', 'uploads/**', 'assets/dependencies/**', 'tasks/**', 'Gruntfile.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        sails: 'readonly',
        User: 'readonly',
        AuthSession: 'readonly',
        AuthAttempt: 'readonly',
        Pet: 'readonly',
        Report: 'readonly',
        Message: 'readonly',
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^(_|unused($|[A-Z]))',
        caughtErrorsIgnorePattern: '^(_|unused($|[A-Z]))',
      }],
    },
  },
  {
    files: ['assets/**/*.js'],
    languageOptions: { globals: { ...globals.browser, SAILS_LOCALS: 'readonly', io: 'readonly' } },
  },
];
