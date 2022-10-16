import { esbuildPluginFilePathExtensions } from 'esbuild-plugin-file-path-extensions'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['**/*.ts', '!**/*.spec.ts', '!node_modules/**', '!dist/**'],
  outDir: 'dist',
  format: ['cjs', 'esm'],
  plugins: [esbuildPluginFilePathExtensions()],
})
