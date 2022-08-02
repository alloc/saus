import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
  },
  {
    entry: ['src/index.ssr.ts'],
    format: ['esm'],
  },
])
