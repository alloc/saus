import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/functions/hook.ts'],
  format: ['cjs', 'esm'],
  splitting: true,
  clean: true,
})
