import { esbuildPluginFilePathExtensions } from 'esbuild-plugin-file-path-extensions'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!*.config.ts',
    '!node_modules/**',
    '!dist/**',
  ],
  outDir: 'dist',
  format: ['cjs', 'esm'],
  bundle: false,
  plugins: [esbuildPluginFilePathExtensions()],
})
