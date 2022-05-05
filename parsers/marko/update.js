const { extractModules } = require('module-extractor')

const extraction = extractModules({
  debug: true,
  entries: ['babel-plugin/parser.js'],
  pkgRoot: './vendor/marko/packages/compiler',
  outPkgRoot: './',
})

extraction.on('packageCreated', pkg => {
  pkg.name = '@saus/marko-parser'
  pkg.main = 'src/babel-plugin/parser.js'
})
