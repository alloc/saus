import { esbuildPluginFilePathExtensions } from 'esbuild-plugin-file-path-extensions'
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
    // Redirected modules
    'bundle/html.ts',
    'bundle/routes/clientStorePlugin.ts',
    'bundle/runtime/api.ts',
    'bundle/runtime/bundle/api.ts',
    'bundle/runtime/bundle/clientStore/index.ts',
    'bundle/runtime/bundle/config.ts',
    'bundle/runtime/bundle/debug.ts',
    'bundle/runtime/bundle/debugBase.ts',
    'bundle/runtime/bundle/moduleMap.ts',
    'bundle/runtime/bundle/routes.ts',
    'bundle/runtime/client/api.ts',
    'bundle/runtime/client/pageClient.ts',
    'bundle/runtime/core/api.ts',
    'bundle/runtime/core/constants.ts',
    'bundle/runtime/defineSecrets.ts',
    'core/constants.ts',
    'secrets/defineSecrets.ts',
  ],
  format: ['cjs', 'esm'],
  target: 'node16',
  splitting: true,
  external: Object.keys(pkgJson.dependencies!).concat('fsevents'),
  noExternal: ['@'],
  define: { __VERSION__: JSON.stringify(pkgJson.version) },
  plugins: [esbuildPluginFilePathExtensions()],
})
