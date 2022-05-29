require('sucrase/dist/register').registerAll()
const { parseMarko } = require('./src/babel-plugin/parser')
const { createTemplate } = require('./src/template')
const { createTagLib } = require('./src/taglib')
const { MarkoFile } = require('./src/file')
const { crawl } = require('recrawl-sync')
const path = require('path')
const fs = require('fs')

const componentFiles = crawl('vendor/marko-todomvc/src/components', {
  absolute: true,
  only: ['*.marko'],
})

const taglib = createTagLib(componentFiles)
const templates = {}

for (const filename of componentFiles) {
  const code = fs.readFileSync(filename, 'utf8')
  const file = new MarkoFile(code, filename, taglib)
  parseMarko(file)

  console.log(filename)
  const name = path.basename(filename, '.marko')
  templates[name] = createTemplate(name, file)
}

// fs.writeFileSync('ast.json', JSON.stringify(file.ast.program, null, 2))
fs.writeFileSync('templates.json', JSON.stringify(templates, null, 2))
