import { defineConfig } from 'tsup'
import { PackageJson } from 'type-fest'

const pkgJson = require('./package.json') as PackageJson

export default defineConfig({
  entry: [
    'src/cli.ts',
    'src/index.ts',
    // Submodules
    'src/core/index.ts',
    'src/core/babel/index.ts',
    'src/core/client/node/api.ts',
    'src/core/http/index.ts',
    'src/build/failedPages.ts',
    'src/build/worker.ts',
    'src/bundle/html.ts',
    'src/deploy/index.ts',
    // Programmatic API
    'src/build/api.ts',
    'src/bundle/api.ts',
    'src/deploy/api.ts',
    'src/dev/api.ts',
    'src/preview/api.ts',
    'src/secrets/api.ts',
    'src/test/api.ts',
  ],
  format: ['cjs'],
  target: 'node16',
  splitting: true,
  sourcemap: true,
  noExternal: ['@'],
  define: { __VERSION__: JSON.stringify(pkgJson.version) },
  clean: true,
})
