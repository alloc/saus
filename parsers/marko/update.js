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
  pkg.type = undefined
  pkg.dependencies['@babel/core'] = '^7.0.0'
})
