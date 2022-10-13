module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: [
      'tsconfig.json',
      'core/client/tsconfig.json',
      'core/runtime/tsconfig.json',
      'core/utils/tsconfig.json',
    ],
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
  },
  root: true,
  ignorePatterns: ['*.js'],
}
