import { crawl } from 'recrawl-sync'
import { defineConfig } from 'tsup'
import { PackageJson } from 'type-fest'

const pkgJson = require('../../../package.json') as PackageJson

export default defineConfig({
  outDir: 'dist',
  entry: crawl(__dirname, {
    only: ['*.ts'],
    skip: ['dist'],
  }),
  format: ['cjs', 'esm'],
  target: 'node16',
  bundle: false,
  external: Object.keys(pkgJson.dependencies!).concat('fsevents'),
  noExternal: ['@'],
})
