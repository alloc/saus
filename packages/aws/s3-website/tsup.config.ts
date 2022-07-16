import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
  },
  {
    entry: { 'index.ssr': 'src/runtime/index.ts' },
    format: ['esm'],
  },
])
