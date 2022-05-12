require('sucrase/dist/register').registerAll({
  matcher: file => !file.includes('@astrojs'),
})

const { parseTemplate } = require('./src/ure/parse')
const path = require('path')
const fs = require('fs')

const code = fs.readFileSync(
  path.resolve('../../fixtures/component-basic/index.astro'),
  'utf8'
)

parseTemplate(code)
// .then(() => {
//   parseTemplate(code)
// })
