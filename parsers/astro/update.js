const { extractModules } = require('module-extractor')

const extraction = extractModules({
  debug: true,
  entries: ['parser/astro-parser/parse.ts'],
  pkgRoot: './vendor/astro-eslint-parser',
  outPkgRoot: './',
  copyFiles: ['tsconfig.json'],
  copyDeps: ['typescript'],
})

extraction.on('packageCreated', pkg => {
  pkg.name = '@saus/astro-parser'
  pkg.main = 'src/parser/astro-parser/parse.ts'
  pkg.devDependencies['@typescript-eslint/types'] = '^5.4.0'
  pkg.dependencies.resolve = '*'
})
