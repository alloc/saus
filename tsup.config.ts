import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/cli.ts',
    'src/index.ts',
    // Submodules
    'src/client/index.ts',
    'src/core/index.ts',
    'src/babel/index.ts',
    // Commands
    'src/build.ts',
    'src/bundle.ts',
    'src/dev.ts',
  ],
  format: ['cjs', 'esm'],
  sourcemap: true,
})