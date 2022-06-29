import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    clean: true,
  },
  {
    entry: ['src/index.ssr.ts'],
    format: ['esm'],
    clean: true,
  },
])
