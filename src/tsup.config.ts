import { defineConfig } from 'tsup'
import { PackageJson } from 'type-fest'

const pkgJson = require('../package.json') as PackageJson

export default defineConfig({
  outDir: '../dist',
  entry: [
    'cli.ts',
    'index.ts',
    // Submodules
    'core/index.ts',
    'core/babel/index.ts',
    'core/client/node/api.ts',
    'core/http/index.ts',
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
  format: ['cjs'],
  target: 'node16',
  splitting: true,
  external: Object.keys(pkgJson.dependencies!).concat('fsevents'),
  noExternal: ['@'],
  define: { __VERSION__: JSON.stringify(pkgJson.version) },
  clean: true,
})
