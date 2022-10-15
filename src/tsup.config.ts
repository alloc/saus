import { defineConfig } from 'tsup'
import { PackageJson } from 'type-fest'

const pkgJson = require('./package.json') as PackageJson

export default defineConfig({
  outDir: 'dist',
  entry: [
    'cli.ts',
    'index.ts',
    // Submodules
    'core/index.ts',
    'client/helpers.ts',
    'client/node/api.ts',
    'build/failedPages.ts',
    'build/worker.ts',
    'bundle/html.ts',
    'deploy/index.ts',
    // Programmatic API
    'build/api.ts',
    'bundle/api.ts',
    'deploy/api.ts',
    'dev/api.ts',
    'preview/api.ts',
    'secrets/api.ts',
    'test/api.ts',
  ],
  format: ['cjs', 'esm'],
  target: 'node16',
  splitting: true,
  external: Object.keys(pkgJson.dependencies!).concat('fsevents'),
  noExternal: ['@'],
  define: { __VERSION__: JSON.stringify(pkgJson.version) },
})
