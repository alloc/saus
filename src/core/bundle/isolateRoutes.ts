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
import { ssrRoutesId } from '../../bundle/constants'
import {
  createModuleProvider,
  ModuleProvider,
} from '../../plugins/moduleProvider'
import { dedupe } from '../../utils/dedupe'
import { plural } from '../../utils/plural'
import {
  loadSourceMap,
  resolveMapSources,
  SourceMap,
} from '../../utils/sourceMap'
import { toDevPath } from '../../utils/toDevPath'
import { compileEsm, exportsId, requireAsyncId } from '../../vm/compileEsm'
import { debug } from '../debug'
import {
  ClientFunction,
  extractClientFunctions,
  SausContext,
  vite,
} from '../index'
import { getViteTransform } from '../viteTransform'
import { RouteImports } from './routeModules'

export const toBundleChunkId = (id: string) =>
  id.replace(/\.[^.]+$/, '.bundle.js')

export type IsolatedModuleMap = Record<string, IsolatedModule>
export type IsolatedModule = { code: string; map?: SourceMap }

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
  const bareImportRE = /^[\w@]/

  // const NULL_BYTE_PLACEHOLDER = `__x00__`
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
  const isolatedCjsModules = new Map<string, string>()
  const cjsNotFoundCache = new Set<string>()

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
      if (bareImportRE.test(id)) {
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

        const maybeCjsModule =
          forceIsolate &&
          resolved.id.endsWith('.js') &&
          !cjsNotFoundCache.has(resolved.id)

        // We have to avoid bundling CommonJS modules with Esbuild,
        // because the output is incompatible with our SSR module system.
        if (maybeCjsModule) {
          if (isolatedCjsModules.has(resolved.id)) {
            return { id: resolved.id, external: true }
          }
          const code = fs.readFileSync(resolved.id, 'utf8')
          const hasEsmSyntax = /^(import|export) /m.test(code)
          if (!hasEsmSyntax && /\b(module|exports|require)\b/.test(code)) {
            isolatedModules[resolved.id] = {
              code,
              map: loadSourceMap(code, resolved.id),
            }
            isolatedCjsModules.set(
              resolved.id,
              relative(config.root, resolved.id)
            )
            return { id: resolved.id, external: true }
          }
          cjsNotFoundCache.add(resolved.id)
        }

        id = resolved.id

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
      const transformed = await transform(toDevPath(id, config.root, true))
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

  const bundle = await rollup.rollup({
    plugins: [bridge],
    input: bundleInputs,
    makeAbsoluteExternalsRelative: false,
    context: 'globalThis',
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
  const rendererUrl = toDevPath(virtualRenderPath, config.root)

  const entryUrlToFileMap: Record<string, string> = {
    [rendererUrl]: context.renderPath,
    ...Object.fromEntries(
      Array.from(routeImports.values(), resolved => [
        resolved.url,
        resolved.file,
      ])
    ),
  }

  const bundleToEntryMap: Record<string, string> = {}

  for (const chunk of generated.output as rollup.OutputChunk[]) {
    let moduleId = chunk.facadeModuleId!
    const map = chunk.map!
    if (moduleId !== virtualRenderPath) {
      resolveMapSources(map, dirname(moduleId))
    }
    const moduleUrl = toDevPath(moduleId, config.root, true)
    const entryPath = entryUrlToFileMap[moduleUrl]
    if (entryPath) {
      moduleId = toBundleChunkId(entryPath)
      bundleToEntryMap[moduleId] = moduleUrl
    } else if (bundleInputs.includes(moduleId)) {
      bundleToEntryMap[moduleId] = moduleUrl
    } else {
      moduleId = resolve(config.root, chunk.fileName)
    }
    isolatedModules[moduleId] = {
      code: chunk.code,
      map,
    }
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
      resolveId(id, importer) {
        if (relativePathRE.test(id)) {
          id = resolve(dirname(importer), id)
          hoistedImports.add(id)
          return toSsrPath(id, config.root)
        }
        const ssrId = id == 'saus/client' ? id : isolatedCjsModules.get(id)
        if (ssrId) {
          hoistedImports.add(id)
          return ssrId
        }
        // Preserve the import declaration.
        return ''
      },
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
            const code = fs.readFileSync(resolved.id, 'utf8')
            isolatedModules[resolved.id] = {
              code,
              map: loadSourceMap(code, resolved.id),
            }
            source = relative(config.root, resolved.id)
            isolatedCjsModules.set(resolved.id, source)
            esmImports.push(`import "${resolved.id}"\n`)
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
    async resolveId(id, importer) {
      if (isolatedModules[id]) {
        return id
      }
      const chunkId = toBundleChunkId(id)
      if (isolatedModules[chunkId]) {
        return chunkId
      }
      // Throw an error if an isolated CJS module is imported by a non-isolated module.
      if (importer && !isolatedModules[importer]) {
        const resolved = await this.resolve(id, importer, { skipSelf: true })
        if (resolved) {
          if (isolatedCjsModules.has(resolved.id))
            throw Error(
              `"${importer}" is ${bold('not')} isolated but depends on ` +
                `an isolated module "${id}", so the import will fail.`
            )

          return resolved
        }
      }
    },
    load(id) {
      return isolatedModules[id]
    },
    transform(code, id) {
      if (isolatedModules[id]) {
        let ssrId = isolatedCjsModules.get(id)
        if (ssrId) {
          return isolateCjsModule(code, id, ssrId, this)
        }
        ssrId = bundleToEntryMap[id]
        if (ssrId == rendererUrl) {
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
        if (!ssrId) {
          ssrId = toSsrPath(id, config.root)
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

const relativePathRE = /^(?:\.\/|(\.\.\/)+)/

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
