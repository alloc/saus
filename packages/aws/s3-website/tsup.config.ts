import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/hook.ts'],
  format: ['cjs', 'esm'],
})
