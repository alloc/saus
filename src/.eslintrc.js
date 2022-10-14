module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: [
      'tsconfig.json',
      'core/client/tsconfig.json',
      'runtime/tsconfig.json',
      'utils/tsconfig.json',
      'vm/tsconfig.json',
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
