import * as esModuleLexer from 'es-module-lexer'
import * as esbuild from 'esbuild'
import fs from 'fs'
import MagicString from 'magic-string'
import { Module } from 'module'
import path from 'path'
import vm from 'vm'
import { getBabelProgram, getImportDeclarations } from '../babel'
import { generateRequireCalls } from '../babel/generateRequireCalls'
import { CompileCache } from '../utils/CompileCache'
import { __importDefault, __importStar } from '../utils/esmInterop'
import { esmExportsToCjs } from '../utils/esmToCjs'
import {
  resolveMapSources,
  SourceMap,
  toInlineSourceMap,
} from '../utils/sourceMap'
import { SausContext } from './context'
import { debug } from './debug'
import { setRoutesModule } from './global'
import { RouteModule } from './routes'
import { vite } from './vite'

type Promisable<T> = T | Promise<T>
type ResolveIdHook = (
  id: string,
  importer: string
) => Promisable<string | undefined>

/**
 * Load the routes module in a Node environment. All local modules are
 * rewritten from ESM to CJS. Dynamic imports are executed according
 * to the given `loadRoute` function.
 */
export async function loadRoutes(
  context: SausContext,
  resolveId: ResolveIdHook = () => undefined,
  loadRoute: (id: string) => Promise<RouteModule> = id => import(id),
  compiledFiles?: Set<string>
) {
  context.compileCache.locked = true
  const time = Date.now()
  const evaluate = await compileRoutesModule(
    context,
    loadRoute,
    resolveId,
    compiledFiles
  )
  const routesConfig = setRoutesModule({
    routes: [],
    runtimeHooks: [],
    defaultState: [],
  })
  try {
    await evaluate()
    context.compileCache.locked = false
    Object.assign(context, routesConfig)
    debug(`Loaded the routes module in ${Date.now() - time}ms`)
  } finally {
    setRoutesModule(null)
  }
}

type ModuleLoader = () => Promise<any>

async function compileRoutesModule(
  { routesPath, root, compileCache, config }: SausContext,
  loadRoute: (id: string) => Promise<RouteModule>,
  resolveId: ResolveIdHook,
  compiledFiles?: Set<string>
) {
  let code = fs.readFileSync(routesPath, 'utf8')
  const editor = new MagicString(code)
  for (const imp of esModuleLexer.parse(code)[0]) {
    if (imp.d >= 0 && imp.n) {
      const resolvedId = await resolveId(imp.n, routesPath)
      if (resolvedId) {
        const resolvedUrl = resolvedId.startsWith(root + '/')
          ? resolvedId.slice(root.length)
          : '/@fs/' + resolvedId

        editor.overwrite(imp.s, imp.e, `"${resolvedUrl}"`)
      }
    }
  }
  const exportsMap: Record<string, Promise<any>> = {}
  const importMeta = { env: { ...config.env, SSR: true } }
  return compileAsyncModule(
    editor.toString(),
    routesPath,
    compileCache,
    importMeta,
    async function requireAsync(id, importer, nodeRequire): Promise<any> {
      const time = Date.now()

      let resolvedId = await resolveId(id, importer)
      let useNodeRequire = true
      let isCached = false

      if (resolvedId && isCompiledModule(resolvedId, root)) {
        compiledFiles?.add(resolvedId)
        useNodeRequire = false
        isCached = resolvedId in exportsMap
      } else {
        resolvedId = nodeRequire.resolve(id)
        isCached = resolvedId in require.cache
      }

      const exports = useNodeRequire
        ? nodeRequire(id)
        : isCached
        ? await exportsMap[resolvedId]
        : await (exportsMap[resolvedId] = compileAsyncModule(
            fs.readFileSync(resolvedId, 'utf8'),
            resolvedId,
            compileCache,
            importMeta,
            requireAsync
          ).then(
            async evaluate => {
              const exports = await evaluate()
              Object.defineProperty(exports, '__esModule', { value: true })
              return exports
            },
            error => {
              error.message =
                'Failed to compile module "${resolvedId}". ' + error.message
              throw error
            }
          ))

      if (!isCached) {
        debug(`Loaded "${resolvedId}" in ${Date.now() - time}ms`)
      }

      return exports
    },
    loadRoute
  )
}

function isCompiledModule(id: string, root: string) {
  return (
    /\.m?[tj]sx?$/.test(id) &&
    !id.includes('/node_modules/') &&
    id.startsWith(root + '/')
  )
}

const importMetaId = '__importMeta'
const importAsyncId = '__importAsync'
const requireAsyncId = '__requireAsync'

async function compileAsyncModule(
  code: string,
  filename: string,
  compileCache: CompileCache,
  importMeta: Record<string, any>,
  requireAsync: (
    id: string,
    importer: string,
    nodeRequire: NodeRequire
  ) => Promise<any>,
  importAsync = requireAsync
): Promise<ModuleLoader> {
  const nodeRequire = Module.createRequire(filename)
  const module = {
    exports: {},
    require: nodeRequire,
    __dirname: path.dirname(filename),
    __filename: filename,
    [importMetaId]: importMeta,
    [importAsyncId]: (id: string) => importAsync(id, filename, nodeRequire),
    [requireAsyncId]: (id: string) => requireAsync(id, filename, nodeRequire),
  }
  const cacheKey = compileCache.key(code)
  const cached = compileCache.get(cacheKey)
  if (cached) {
    code = cached
  } else {
    // Transform into JavaScript ESM.
    let script = await compileToEsm(code, filename)

    const ast = getBabelProgram(script.code, filename)
    const editor = new MagicString(script.code)

    // Rewrite async imports and import.meta access
    for (const imp of esModuleLexer.parse(script.code)[0]) {
      if (imp.d >= 0) {
        editor.overwrite(imp.ss, imp.s - 1, importAsyncId)
      } else if (imp.d == -2) {
        editor.overwrite(imp.s, imp.e, importMetaId)
      }
    }

    // Convert export statements to CJS.
    esmExportsToCjs(ast, editor, `await ${requireAsyncId}`)

    const requireCalls: string[] = []
    const requireHelpers = new Set<Function>()

    // Generate require calls from import statements.
    for (const { node } of getImportDeclarations(ast)) {
      editor.overwrite(node.start!, node.end! + 1, '')
      const { needsImportStar, needsImportDefault } = generateRequireCalls(
        node,
        requireAsyncId,
        requireCalls
      )
      if (needsImportStar) {
        requireHelpers.add(__importStar)
      }
      if (needsImportDefault) {
        requireHelpers.add(__importDefault)
      }
    }

    editor.prepend(requireCalls.join(''))
    if (requireHelpers.size)
      editor.prepend(
        Array.from(requireHelpers, fn => fn.toString()).join('\n') + '\n'
      )

    const topLevelId = '__compiledModule'
    editor.prepend(`async function ${topLevelId}(__moduleContext) {\n`)
    const eofLineBreak = script.code.endsWith('\n') ? '' : '\n'
    editor.append(eofLineBreak + `}`)

    // Apply the edits.
    script = overwriteScript(filename, script, {
      code: editor.toString(),
      map: editor.generateMap({ hires: true }),
    })

    // Ensure the module works in the current Node version.
    script = await compileToNode(filename, script, process.version.slice(1))

    // Inject module context. This is necessary to prevent Esbuild from
    // renaming the `require` variable to `require2` which is wrong.
    code = script.code.replace(
      '__moduleContext',
      Object.keys(module).join(', ')
    )

    // Return function and append the inline sourcemap.
    code += `\n  return ${topLevelId}`
    code = `(function() {${code}\n})()` + toInlineSourceMap(script.map!)

    compileCache.set(cacheKey, code)
  }
  return (): Promise<any> => {
    const init = vm.runInThisContext(code, { filename })
    return init(...Object.values(module)).then(() => module.exports)
  }
}

type Script = { code: string; map?: SourceMap }

function overwriteScript(
  filename: string,
  oldScript: Script,
  newScript: { code: string; map?: any }
): Script {
  let map: SourceMap | undefined
  if (oldScript.map && newScript.map) {
    map = vite.combineSourcemaps(filename, [
      newScript.map,
      oldScript.map as any,
    ]) as any
  } else {
    map = newScript.map || oldScript.map
  }
  return {
    code: newScript.code,
    map,
  }
}

async function compileToEsm(code: string, filename: string): Promise<Script> {
  const lang = path.extname(filename)
  if (/\.m?js/.test(lang)) {
    return { code, map: undefined }
  }
  const compiled = await esbuild.transform(code, {
    format: 'esm',
    target: 'esnext',
    loader: lang.slice(1) as any,
    sourcemap: 'external',
    sourcefile: filename,
  })
  const map = JSON.parse(compiled.map)
  resolveMapSources(map, process.cwd())
  return { code: compiled.code, map }
}

async function compileToNode(
  filename: string,
  script: Script,
  version: string
) {
  const compiled = await esbuild.transform(script.code, {
    format: 'cjs',
    target: `node${version}`,
    loader: 'js',
    sourcemap: 'external',
    sourcefile: filename,
  })
  const map = JSON.parse(compiled.map)
  resolveMapSources(map, process.cwd())
  return overwriteScript(filename, script, {
    code: compiled.code,
    map,
  })
}
