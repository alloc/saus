import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/*'],
  format: ['cjs', 'esm'],
  bundle: false,
  sourcemap: true,
})
