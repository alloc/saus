import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/cli.ts',
    'src/index.ts',
    // Submodules
    'src/core/index.ts',
    'src/bundle/runtime/html.ts',
    'src/babel/index.ts',
    'src/build/worker.ts',
    // Commands
    'src/build.ts',
    'src/bundle.ts',
    'src/dev.ts',
  ],
  format: ['cjs'],
  splitting: true,
  sourcemap: true,
  external: Object.keys(require('./package.json').dependencies),
})
