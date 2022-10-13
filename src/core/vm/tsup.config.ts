import { defineConfig } from 'tsup'
import { PackageJson } from 'type-fest'

const pkgJson = require('../../../package.json') as PackageJson

export default defineConfig({
  outDir: 'dist',
  entry: ['index.ts'],
  format: ['cjs', 'esm'],
  target: 'node16',
  external: Object.keys(pkgJson.dependencies!).concat('fsevents'),
  noExternal: ['@'],
})
