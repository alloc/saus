import endent from 'endent'
import * as esbuild from 'esbuild'
import path from 'path'
import vm from 'vm'
import { SourceMap, toInlineSourceMap } from '../bundle/sourceMap'
import { SausContext } from './context'
import { debug } from './debug'
import { setRoutesModule } from './global'
import { vite } from './vite'

const sausRoot = vite.normalizePath(path.resolve(__dirname, '..')) + '/'
const noExternal = /\/(client|examples|node_modules|packages|src)\//
const isExternal = (id: string) =>
  id.startsWith(sausRoot) && !noExternal.test(id)

const importIdent = '__vite_ssr_dynamic_import__'
const importWrapper = endent`
  const ${importIdent} = id => import(id);
`

export async function loadRoutes(context: SausContext) {
  const resolveId = context.config.createResolver({
    asSrc: false,
  })

  const buildPlugin: esbuild.Plugin = {
    name: 'saus:loadRoutes',
    setup(build) {
      build.onResolve({ filter: /.+/ }, async ({ path, importer, kind }) => {
        if (kind == 'import-statement' || kind == 'require-call') {
          const resolved = await resolveId(path, importer)
          if (resolved && resolved[0] == '/') {
            const external = isExternal(resolved)
            if (external) {
              debug(`[loadRoutes] externalized "${resolved}"`)
            }
            return {
              path: resolved,
              external,
            }
          }
          debug(`[loadRoutes] externalized "${path}"`)
          return {
            path,
            external: true,
          }
        } else if (kind == 'dynamic-import') {
          return { path, external: true }
        }
      })
    },
  }

  const buildResult = await esbuild.build({
    entryPoints: [context.routesPath],
    plugins: [buildPlugin],
    loader: {
      '.ts': 'ts',
      '.js': 'js',
      '.json': 'json',
    },
    write: false,
    target: 'node16',
    format: 'cjs',
    bundle: true,
    treeShaking: false,
    sourcemap: 'external',
    define: { 'import.meta.env.SSR': 'true' },
    outfile: path.basename(context.routesPath).replace(/\.ts$/, '.js'),
  })

  // Replace dynamic imports with "__vite_ssr_dynamic_import__"
  // so that route importers can be parsed.
  const script =
    importWrapper +
    buildResult.outputFiles[1].text.replace(/\bimport\(/g, importIdent + '(')

  const map = JSON.parse(buildResult.outputFiles[0].text) as SourceMap

  map.sources = map.sources.map(source => {
    return path.resolve(source)
  })

  setRoutesModule(context)
  try {
    vm.runInThisContext(
      '(0, function(exports,require) {' +
        script +
        '\n})' +
        toInlineSourceMap(map)
    )({}, require)
  } finally {
    setRoutesModule(null)
  }
}
