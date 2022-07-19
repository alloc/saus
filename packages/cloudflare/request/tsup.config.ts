import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/request.ts'],
  format: ['cjs', 'esm'],
  splitting: true,
  clean: true,
})
