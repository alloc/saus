import { codeFrameColumns } from '@babel/code-frame'
import { createFilter } from '@rollup/pluginutils'
import endent from 'endent'
import escalade from 'escalade/sync'
import fs from 'fs'
import { bold } from 'kleur/colors'
import MagicString from 'magic-string'
import md5Hex from 'md5-hex'
import { startTask } from 'misty/task'
import { dirname, isAbsolute, relative, resolve } from 'path'
import * as rollup from 'rollup'
import { babel, resolveReferences, t } from '../../babel'
import {
  createModuleProvider,
  ModuleProvider,
} from '../../plugins/moduleProvider'
import { dedupe } from '../../utils/dedupe'
import { bareImportRE, relativePathRE } from '../../utils/importRegex'
import { plural } from '../../utils/plural'
import { relativeToCwd } from '../../utils/relativeToCwd'
import {
  loadSourceMap,
  resolveMapSources,
  SourceMap,
} from '../../utils/sourceMap'
import { toDevPath } from '../../utils/toDevPath'
import { compileEsm, exportsId, requireAsyncId } from '../../vm/compileEsm'
import { ForceLazyBindingHook } from '../../vm/types'
import { debug } from '../debug'
import {
  ClientFunction,
  extractClientFunctions,
  SausContext,
  vite,
} from '../index'
import { getViteTransform } from '../viteTransform'
import { findLiveBindings, LiveBinding, matchLiveBinding } from './liveBindings'
import { RouteImports } from './routeModules'

export type IsolatedModuleMap = Record<string, IsolatedModule>
export type IsolatedModule = {
  code: string
  map?: SourceMap
  liveBindings?: LiveBinding[]
}

/**
 * Wrap modules with a runtime module system, so separate instances of each
 * module can be created for each rendered page. This removes the need for
 * manual SSR cleanup of global state. In the future, it will also be used
 * for route-specific bundles.
 *
 * The `isolatedModules` object is populated by this function.
 */
export async function isolateRoutes(
  context: SausContext,
  routeImports: RouteImports,
  isolatedModules: IsolatedModuleMap
): Promise<vite.Plugin> {
  const { config } = context
  const modules = createModuleProvider()

  const { transform, pluginContainer } = await getViteTransform({
    ...config,
    resolve: {
      ...config.resolve,
      conditions: ['ssr'],
    },
    plugins: [
      modules,
      rewriteRouteImports(context.routesPath, routeImports),
      ...config.plugins.filter(p => {
        // CommonJS modules are externalized, so this plugin is just overhead.
        return p.name !== 'commonjs'
      }),
    ],
    build: {
      ...config.build,
      sourcemap: true,
      ssr: true,
      target: 'esnext',
    },
    ssr: {
      ...config.ssr,
      noExternal: [],
      external: [],
    },
  })

  // Some plugins rely on this hook (like vite:css)
  await pluginContainer.buildStart({})

  const virtualRenderPath = resolve(config.root, '.saus/render.js')
  const rendererModule = await transform(
    toDevPath(context.renderPath, config.root, true)
  )
  const rendererMap = isolateRenderers(
    context.renderPath,
    rendererModule as any,
    virtualRenderPath,
    modules,
    config
  )

  const sausExternalRE = /\bsaus(?!.*\/(packages|examples))\b/
  const nodeModulesRE = /\/node_modules\//

  const isVirtual = (id: string) => id[0] === '\0'
  const shouldForceIsolate = createFilter(
    config.saus.bundle?.isolate || /^$/,
    undefined,
    { resolve: false }
  )

  const shouldResolve = (id: string, importer: string) => {
    const pkgId = 'package.json'
    // TODO: cache this lookup to reduce I/O (try to use Vite cache)
    let pkgPath = escalade(dirname(importer), (parent, children) => {
      if (parent == config.root) {
        return pkgId
      }
      return children.find(name => name == pkgId)
    })
    // Be careful not to leave unresolved imports that rely on
    // package.json files deep within the project root, because
    // Rollup will try (and fail) to resolve them using the
    // project root as the base directory.
    pkgPath = pkgPath && relative(config.root, dirname(pkgPath))
    if (pkgPath && /[^.]/.test(pkgPath[0])) {
      return true
    }
    // We let Rollup resolve imports by project files, so the
    // module provider created in `generateSsrBundle` is used.
    return !importer.startsWith(config.root + '/')
  }

  // CommonJS modules that are forced to isolate must be bundled
  // with Rollup to work properly. This object maps a specific
  // import statement to its resolved module path.
  const isolatedCjsModules = new Set<string>()
  const cjsNotFoundCache = new Set<string>()

  // SSR modules need to be named, and this maps the rolled paths and
  // source paths to their SSR module name.
  const isolatedIds: Record<string, string> = {}

  // Live bindings for each output chunk.
  const liveBindingsByChunk = new Map<rollup.RenderedChunk, LiveBinding[]>()

  // This plugin bridges Rollup and Vite.
  const bridge: rollup.Plugin = {
    name: 'vite-bridge',
    async resolveId(id, importer) {
      if (!importer) {
        return id
      }
      if (sausExternalRE.test(id)) {
        return { id, external: true }
      }
      let forceIsolate = false
      if (bareImportRE.test(id) && !id.startsWith('@/')) {
        forceIsolate = shouldForceIsolate(id)
        if (!forceIsolate && !shouldResolve(id, importer)) {
          return { id, external: true }
        }
      }
      const resolved = await pluginContainer.resolveId(id, importer, {
        ssr: true,
      })
      if (resolved) {
        if (resolved.id == '__vite-browser-external') {
          return { id, external: true }
        }

        id = resolved.id

        const maybeCjsModule =
          forceIsolate && id.endsWith('.js') && !cjsNotFoundCache.has(id)

        // Prefer bundling CommonJS modules ourselves, instead of relying on Rollup.
        if (maybeCjsModule) {
          if (isolatedCjsModules.has(id)) {
            return { id, external: true }
          }
          const code = fs.readFileSync(id, 'utf8')
          const hasEsmSyntax = /^(import|export) /m.test(code)
          if (!hasEsmSyntax && /\b(module|exports|require)\b/.test(code)) {
            const map = loadSourceMap(code, id)
            isolatedCjsModules.add(id)
            isolatedModules[id] = { code, map }
            isolatedIds[id] = toSsrPath(id, config.root)
            return { id, external: true }
          }
          cjsNotFoundCache.add(id)
        }

        if (isVirtual(id)) {
          return id
        }

        const sideEffects =
          resolved.moduleSideEffects != null
            ? !!resolved.moduleSideEffects
            : undefined

        // TODO: handle "relative" and "absolute" external values
        let external =
          !forceIsolate &&
          (!!resolved.external ||
            !id.startsWith(config.root + '/') ||
            nodeModulesRE.test(id.slice(config.root.length)))

        if (isAbsolute(id)) {
          if (fs.existsSync(id)) {
            if (external) {
              // Prepend /@fs/ for fast resolution post-isolation.
              id = '/@fs/' + id
            }
          } else if (!forceIsolate) {
            // Probably an asset from publicDir.
            external = true
          }
        }

        return {
          id,
          external,
          sideEffects,
        }
      }
      if (id.endsWith('.node')) {
        return { id, external: true }
      }
    },
    async load(id) {
      try {
        var transformed = await transform(toDevPath(id, config.root, true))
      } catch (e: any) {
        // Acorn parsing error
        const loc = /\((\d+):(\d+)\)$/.exec(e.message)
        if (loc && e.pluginCode) {
          const line = Number(loc[1])
          const column = Number(loc[2]) + 1
          const lines = e.pluginCode.split('\n') as string[]
          if (line == lines.length && lines[line - 1][column - 1] == null) {
            e.message = 'Unexpected end of file'
          }
          const frame = codeFrameColumns(
            e.pluginCode,
            { start: { line, column } },
            {
              message: e.message,
              highlightCode: true,
              linesAbove: 10,
              linesBelow: 10,
            }
          )
          e.message += '\n\n' + frame + '\n'
        }
        throw e
      }
      if (transformed) {
        let { code, map } = transformed as IsolatedModule
        if (map) {
          map.sources = map.sources.map(source => {
            return source ? relative(dirname(id), source) : null!
          })
        }
        return {
          code,
          map,
        }
      }
    },
    async generateBundle(_, bundle) {
      const chunks = Object.values(bundle).filter(
        chunk => chunk.type == 'chunk'
      ) as rollup.OutputChunk[]

      for (const chunk of chunks) {
        const ast: any = this.parse(chunk.code)
        const importer = chunk.facadeModuleId!
        const liveBindings = await findLiveBindings(ast, async id => {
          if (relativePathRE.test(id)) {
            return resolve(dirname(importer), id)
          }
          return id
        })
        liveBindingsByChunk.set(chunk, liveBindings)
      }
    },
  }

  const task = startTask(`Bundling routes...`)

  const routeEntryPoints = dedupe(
    Array.from(routeImports.values(), resolved => resolved.file)
  )

  debug(`route entries: %O`, routeEntryPoints)

  const bundleInputs = [
    virtualRenderPath,
    context.routesPath,
    ...Object.keys(rendererMap),
    ...routeEntryPoints,
  ]

  const importCycles: string[][] = []

  const bundle = await rollup.rollup({
    plugins: [bridge],
    input: bundleInputs,
    makeAbsoluteExternalsRelative: false,
    context: 'globalThis',
    onwarn(warning, warn) {
      if (warning.code == 'CIRCULAR_DEPENDENCY') {
        const cycle = warning.cycle!.map(id => resolve(config.root, id))
        importCycles.push(cycle)
        debug(
          `Circular import may lead to unexpected behavior\n `,
          cycle.map(relativeToCwd).join(' → ')
        )
      } else {
        warn(warning)
      }
    },
  })

  const generated = await bundle.generate({
    dir: config.root,
    format: 'esm',
    sourcemap: 'hidden',
    minifyInternalExports: false,
    preserveModules: true,
  })

  await pluginContainer.close()

  task.finish(`${plural(routeEntryPoints.length, 'route')} bundled.`)

  const routesUrl = toDevPath(context.routesPath, config.root)

  // Rollup changes the file extension of rolled modules to use ".js"
  // and this maps the source paths to their rolled path.
  const rolledModulePaths: Record<string, string> = {}

  for (const chunk of generated.output as rollup.OutputChunk[]) {
    const modulePath = chunk.facadeModuleId!
    const rolledPath = resolve(config.root, chunk.fileName)
    const liveBindings = liveBindingsByChunk.get(chunk)

    const ssrId = bundleInputs.includes(modulePath)
      ? toDevPath(modulePath, config.root, true)
      : toSsrPath(modulePath, config.root)

    const map = chunk.map!
    if (modulePath !== virtualRenderPath) {
      resolveMapSources(map, dirname(modulePath))
    }

    isolatedIds[modulePath] = ssrId
    isolatedIds[rolledPath] = ssrId
    isolatedModules[rolledPath] = { code: chunk.code, map, liveBindings }
    rolledModulePaths[modulePath] = rolledPath
  }

  const resolveSsrImports =
    (hoistedImports: Set<string>) =>
    async (id: string, importer?: string | null) => {
      if (importer && relativePathRE.test(id)) {
        id = resolve(dirname(importer), id)
        hoistedImports.add(id)
        return isolatedIds[id] || toSsrPath(id, config.root)
      }

      const ssrId =
        id == 'saus/client'
          ? id
          : isolatedCjsModules.has(id) && toSsrPath(id, config.root)

      if (ssrId) {
        hoistedImports.add(id)
        return ssrId
      }

      // Preserve the import declaration.
      return ''
    }

  const circularImports = importCycles.map(cycle =>
    cycle
      .slice(-2)
      .map(id => rolledModulePaths[id])
      .join(' > ')
  )

  const forceLazyBinding: ForceLazyBindingHook = (
    imported,
    source,
    importer
  ) => {
    let modulePath: string | undefined
    if (source[0] == '/') {
      modulePath = config.root + source
      modulePath = rolledModulePaths[modulePath]
    }
    // Outside the project root
    else if (source[0] == '.') {
      modulePath = resolve(config.root, source)
      modulePath = rolledModulePaths[modulePath]
    }
    // Runtime-defined module
    if (!modulePath) {
      return false
    }
    if (isolatedCjsModules.has(modulePath)) {
      return true
    }
    if (circularImports.includes(importer + ' > ' + modulePath)) {
      return true
    }
    const { liveBindings } = isolatedModules[modulePath] || {}
    if (!liveBindings || !liveBindings.length) {
      return false
    }
    imported = imported.filter(name =>
      matchLiveBinding(name, liveBindings, isolatedModules)
    )
    if (imported.length) {
      return imported
    }
    return false
  }

  const isolateSsrModule = async (code: string, id: string, ssrId: string) => {
    const hoistedImports = new Set<string>()
    const esmHelpers = new Set<Function>()

    const editor = await compileEsm({
      code,
      filename: id,
      keepImportCalls: true,
      keepImportMeta: true,
      esmHelpers,
      resolveId: resolveSsrImports(hoistedImports),
      forceLazyBinding,
    })

    // These imports ensure the isolated modules are included in
    // the SSR bundle. Some will be caught by our `resolveId` hook
    // and others (namely isolated CJS modules) correspond to an
    // existing file which is overridden by our `load` hook.
    for (const id of hoistedImports) {
      editor.prepend(`import "${id}"\n`)
    }

    if (ssrId == routesUrl) {
      const routeModulePaths = new Set(
        Array.from(routeImports.values(), resolved => resolved.file)
      )
      for (const file of routeModulePaths) {
        editor.prepend(`import "${file}"\n`)
      }
    }

    editor.prependRight(
      editor.hoistIndex,
      `__d("${ssrId}", async (${exportsId}) => {\n`
    )
    editor.append('\n})')

    const esmHelperIds = Array.from(esmHelpers, f => f.name)
    esmHelperIds.unshift(`__d`, requireAsyncId)
    editor.prepend(`import { ${esmHelperIds.join(', ')} } from "saus/core"\n`)

    const map = editor.generateMap({ hires: true })
    map.sources = [id]

    return {
      map,
      code: editor.toString(),
      moduleSideEffects: 'no-treeshake' as const,
    }
  }

  const isolateCjsModule = async (
    code: string,
    id: string,
    ssrId: string,
    context: vite.RollupPluginContext
  ) => {
    const editor = new MagicString(code)

    let resolving: Promise<any>[] = []
    let esmImports: string[] = []
    let injectCjsRequire = false

    babel.traverse(babel.parseSync(code), {
      CallExpression: callPath => {
        const calleePath = callPath.get('callee')
        if (!calleePath.isIdentifier({ name: 'require' })) {
          return
        }

        const sourceArg = callPath.get('arguments')[0]
        if (!sourceArg.isStringLiteral() || callPath.getFunctionParent()) {
          injectCjsRequire = true
          return void editor.overwrite(
            calleePath.node.start!,
            calleePath.node.end!,
            'cjsRequire'
          )
        }

        let source = sourceArg.node.value

        // Avoid isolating dependencies unless forced to.
        if (bareImportRE.test(source) && !shouldForceIsolate(source)) {
          const importId = sourceArg.scope.generateUid()
          esmImports.push(`import * as ${importId} from "${source}"\n`)
          return void editor.overwrite(
            callPath.node.start!,
            callPath.node.end!,
            importId
          )
        }

        // The `require` function is async in SSR.
        editor.overwrite(
          calleePath.node.start!,
          calleePath.node.end!,
          `await ` + requireAsyncId
        )

        const importer = id
        resolving.push(
          context.resolve(source, importer).then(async resolved => {
            if (!resolved) {
              context.error(
                `Failed to resolve import "${source}" from "${relative(
                  process.cwd(),
                  importer
                )}". Does the file exist?`,
                sourceArg.node.start!
              )
            }
            const file = resolved.id
            const code = fs.readFileSync(file, 'utf8')
            const map = loadSourceMap(code, file)
            isolatedCjsModules.add(file)
            isolatedModules[file] = { code, map }
            isolatedIds[file] = toSsrPath(file, config.root)
            esmImports.push(`import "${file}"\n`)
            editor.overwrite(
              sourceArg.node.start!,
              sourceArg.node.end!,
              `"${source}"`
            )
          })
        )
      },
    })

    await Promise.all(resolving)

    if (injectCjsRequire) {
      editor.prepend(`const cjsRequire = id => require(id)\n`)
    }
    editor.prepend(esmImports.join(''))
    editor.prepend(`import { __d, ${requireAsyncId} } from "saus/core"\n`)
    editor.prependRight(0, `__d("${ssrId}", async (exports, module) => {\n`)
    editor.append(`\n})`)

    return {
      code: editor.toString(),
      map: editor.generateMap({ hires: true }),
      moduleSideEffects: 'no-treeshake' as const,
    }
  }

  return {
    name: 'saus:isolatedModules',
    enforce: 'pre',
    async redirectModule(id, importer) {
      const rolledPath = rolledModulePaths[id]
      if (rolledPath) {
        return rolledPath
      }
      if (isolatedModules[id]) {
        return id
      }
      if (id == context.renderPath) {
        return virtualRenderPath
      }
      // Throw an error if an isolated CJS module is imported by a non-isolated module.
      if (importer && !isolatedModules[importer]) {
        if (isolatedCjsModules.has(id))
          throw Error(
            `"${importer}" is ${bold('not')} isolated but depends on ` +
              `an isolated module "${id}", so the import will fail.`
          )
      }
    },
    load(id) {
      return isolatedModules[id]
    },
    async transform(code, id) {
      if (id == virtualRenderPath) {
        const editor = new MagicString(code)
        for (const chunkPath in rendererMap) {
          editor.prepend(`import "${chunkPath}"\n`)
        }
        return {
          code: editor.toString(),
          map: editor.generateMap(),
          moduleSideEffects: 'no-treeshake',
        }
      }
      const ssrId = isolatedIds[id]
      if (ssrId) {
        if (isolatedCjsModules.has(id)) {
          return isolateCjsModule(code, id, ssrId, this)
        }
        return isolateSsrModule(code, id, ssrId)
      }
    },
  }
}

function toSsrPath(id: string, root: string) {
  const relativeId = relative(root, id)
  return relativePathRE.test(relativeId) ? relativeId : '/' + relativeId
}

function rewriteRouteImports(
  routesPath: string,
  routeImports: RouteImports
): vite.Plugin {
  return {
    name: 'saus:rewriteRouteImports',
    enforce: 'pre',
    async transform(code, id) {
      if (id === routesPath) {
        const editor = new MagicString(code)
        for (const [imp, resolved] of routeImports.entries()) {
          editor.overwrite(imp.s + 1, imp.e - 1, resolved.url)
          editor.overwrite(imp.d, imp.d + 6, requireAsyncId)
        }
        return {
          code: editor.toString(),
          map: editor.generateMap(),
          moduleSideEffects: 'no-treeshake',
        }
      }
    },
  }
}

function isolateRenderers(
  renderPath: string,
  renderModule: IsolatedModule,
  virtualRenderPath: string,
  modules: ModuleProvider,
  config: vite.ResolvedConfig
) {
  const rendererMap: Record<string, IsolatedModule> = {}
  const rendererList: string[] = []

  const functions = extractClientFunctions(
    renderPath.replace(/\.[^.]+$/, '.js'),
    renderModule.code,
    true
  )

  for (const type of ['beforeRender', 'render'] as const) {
    for (const func of functions[type]) {
      const editor = new MagicString(renderModule.code)
      const chunk = createRendererChunk(type, func, editor)

      if (renderModule.map)
        chunk.map = vite.combineSourcemaps(renderPath, [
          chunk.map as any,
          renderModule.map as any,
        ]) as any

      const hash = md5Hex(chunk.code).slice(0, 8)
      const chunkPath = renderPath.replace(/\.[^.]+$/, `.${hash}.js`)
      rendererMap[chunkPath] = chunk
      modules.addModule({
        id: toDevPath(chunkPath, config.root, true),
        ...chunk,
      })

      const chunkId = '/' + relative(config.root, chunkPath)
      rendererList.push(
        `[${JSON.stringify(
          func.route
        )}, () => ${requireAsyncId}("${chunkId}")],`
      )
    }
  }

  modules.addModule({
    id: toDevPath(virtualRenderPath, config.root),
    code: endent`
      import { addRenderers, ${requireAsyncId} } from "saus/core"

      addRenderers([
        ${rendererList.join('\n')}
      ])
    `,
  })

  return rendererMap
}

/**
 * Each renderer gets its own chunk so it can be reloaded once
 * per rendered page.
 */
function createRendererChunk(
  type: 'render' | 'beforeRender',
  func: ClientFunction,
  editor: MagicString
): IsolatedModule {
  const preservedRanges: [number, number][] = []
  const preserveRange = (p: { node: t.Node }) =>
    preservedRanges.push([p.node.start!, p.node.end!])

  const callee = func.callee!
  let callExpr = callee.findParent(p =>
    p.isCallExpression()
  )! as babel.NodePath<t.CallExpression>

  // Preserve the render/beforeRender call and any chained calls.
  const callStmt = callExpr.getStatementParent()!
  preserveRange(callStmt)

  // Preserve any referenced statements.
  while ((callExpr = callExpr.findParent(p => p.isCallExpression()) as any)) {
    resolveReferences(callExpr.get('arguments')).forEach(preserveRange)
  }
  resolveReferences(callee).forEach(preserveRange)
  func.referenced.forEach(preserveRange)

  // Sort the preserved ranges in order of appearance.
  preservedRanges.sort(([a], [b]) => a - b)

  // Remove the unused ranges.
  editor.remove(0, preservedRanges[0][0])
  preservedRanges.forEach(([, removedStart], i) => {
    const nextRange = preservedRanges[i + 1]
    const removedEnd = nextRange ? nextRange[0] - 1 : editor.original.length
    if (removedStart < removedEnd) {
      editor.remove(removedStart, removedEnd)
    }
  })

  return {
    code: editor.toString(),
    map: editor.generateMap(),
  }
}
