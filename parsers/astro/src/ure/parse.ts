import { inspect } from 'util'

type AstroCompiler = typeof import('@astrojs/compiler') &
  typeof import('@astrojs/compiler/utils')

let compilerPromise: Promise<AstroCompiler>

export async function parseTemplate(code: string) {
  console.time('loadAstro')
  const { parse, walk } = await (compilerPromise ||= loadAstro())
  console.timeEnd('loadAstro')
  console.time('parse')
  const { ast } = await parse(code)
  console.timeEnd('parse')
  console.log(inspect(ast, { depth: 999, colors: true }))
  let depth = 0
  let parents = new Map<any, number>()
  walk(ast, (node, parent) => {
    const parentDepth = parents.get(parent)
    depth = parentDepth !== undefined ? 1 + parentDepth : 0
    parents.set(node, depth)
    console.log(depth, node.type, Object.keys(node))
  })
}

const dynamicImport = eval('id => import(id)')

async function loadAstro() {
  return {
    ...(await dynamicImport('@astrojs/compiler')),
    ...(await dynamicImport('@astrojs/compiler/utils')),
  }
}
