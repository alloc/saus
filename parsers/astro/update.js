const { extractModules } = require('module-extractor')

const extraction = extractModules({
  entries: ['parser/astro-parser/parse.ts'],
  pkgRoot: './vendor/astro-eslint-parser',
  outPkgRoot: './',
  // copyDeps: ['@types/eslint-scope'],
})

extraction.on('packageCreated', pkg => {
  pkg.name = '@saus/astro-parser'
  pkg.main = 'src/parser/astro-parser/parse.ts'
  pkg.devDependencies['@typescript-eslint/types'] = '^5.4.0'
})
