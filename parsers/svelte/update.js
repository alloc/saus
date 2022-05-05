const { extractModules } = require('module-extractor')

const extraction = extractModules({
  entries: ['compiler/parse/index.ts'],
  pkgRoot: './vendor/svelte',
  outPkgRoot: './',
})

extraction.on('packageCreated', pkg => {
  pkg.name = '@saus/svelte-parser'
  pkg.main = 'src/compiler/parse/index.ts'
})
