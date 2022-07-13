import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/plugin.ts'],
  format: ['cjs', 'esm'],
  splitting: true,
  clean: true,
})
