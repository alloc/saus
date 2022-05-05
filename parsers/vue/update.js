const { extractModules } = require('module-extractor')

const extraction = extractModules({
  entries: ['parse.ts'],
  pkgRoot: './vendor/vue/packages/compiler-core',
  outPkgRoot: './',
})

extraction.on('packageCreated', pkg => {
  pkg.name = '@saus/vue-parser'
  pkg.main = 'src/parse.ts'
})
