import { createFilter } from '@rollup/pluginutils'
import endent from 'endent'
import * as esbuild from 'esbuild'
import escalade from 'escalade/sync'
import fs from 'fs'
import { bold } from 'kleur/colors'
import MagicString from 'magic-string'
import md5Hex from 'md5-hex'
import { startTask } from 'misty/task'
import { dirname, isAbsolute, relative, resolve } from 'path'
import { babel, resolveReferences, t } from '../../babel'
import { ssrRoutesId } from '../../bundle/constants'
import {
  createModuleProvider,
  ModuleProvider,
} from '../../plugins/moduleProvider'
import { dedupe } from '../../utils/dedupe'
import { plural } from '../../utils/plural'
import {
  resolveMapSources,
  SourceMap,
  toInlineSourceMap,
} from '../../utils/sourceMap'
import { toDevPath } from '../../utils/toDevPath'
import { compileEsm, requireAsyncId } from '../../vm/compileEsm'
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

/**
 * Wrap modules with a runtime module system, so separate instances of each
 * module can be created for each rendered page. This removes the need for
 * manual SSR cleanup of global state. In the future, it will also be used
 * for route-specific bundles.
 */
export async function isolateRoutes(
  context: SausContext,
  routeImports: RouteImports,
  inlinePlugins: vite.Plugin[]
): Promise<vite.Plugin> {
  const { config } = context
  const modules = createModuleProvider()

  const { transform, pluginContainer } = await getViteTransform({
    ...config,
    plugins: [
      modules,
      rewriteRouteImports(context.routesPath, routeImports),
      ...inlinePlugins,
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
  const resolveVirtual = (id: string) => ({
    // Replace the null byte so it's visible in compiled code
    // when esbuild prepends the filename of the inlined module.
    path: id, // id.replace('\0', NULL_BYTE_PLACEHOLDER),
    namespace: 'virtual',
  })

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

  // This plugin bridges Esbuild and Vite.
  const bridge: esbuild.Plugin = {
    name: 'vite-bridge',
    setup(build) {
      build.onResolve({ filter: /.+/ }, async ({ path, importer }) => {
        if (!importer) {
          return { path }
        }
        if (sausExternalRE.test(path)) {
          return { path, external: true }
        }
        let forceIsolate = false
        if (bareImportRE.test(path)) {
          forceIsolate = shouldForceIsolate(path)
          if (!forceIsolate && !shouldResolve(path, importer)) {
            return { path, external: true }
          }
        }
        const resolved = await pluginContainer.resolveId(
          path,
          importer,
          undefined,
          true
        )
        if (resolved) {
          if (resolved.id == '__vite-browser-external') {
            return { path, external: true }
          }

          const maybeCjsModule =
            forceIsolate &&
            resolved.id.endsWith('.js') &&
            !cjsNotFoundCache.has(resolved.id)

          // We have to avoid bundling CommonJS modules with Esbuild,
          // because the output is incompatible with our SSR module system.
          if (maybeCjsModule) {
            if (isolatedCjsModules.has(resolved.id)) {
              return { path: resolved.id, external: true }
            }
            const code = fs.readFileSync(resolved.id, 'utf8')
            const hasEsmSyntax = /^(import|export) /m.test(code)
            if (!hasEsmSyntax && /\b(module|exports|require)\b/.test(code)) {
              isolatedCjsModules.set(
                resolved.id,
                relative(config.root, resolved.id)
              )
              return { path: resolved.id, external: true }
            }
            cjsNotFoundCache.add(resolved.id)
          }

          path = resolved.id

          if (isVirtual(path)) {
            return resolveVirtual(path)
          }

          const sideEffects =
            resolved.moduleSideEffects != null
              ? !!resolved.moduleSideEffects
              : undefined

          // TODO: handle "relative" and "absolute" external values
          const external =
            !forceIsolate &&
            (!!resolved.external ||
              !path.startsWith(config.root + '/') ||
              nodeModulesRE.test(path.slice(config.root.length)))

          // Prepend /@fs/ for faster resolution by Rollup.
          if (external && isAbsolute(path) && fs.existsSync(path)) {
            path = '/@fs/' + path
          }

          return {
            path,
            external,
            sideEffects,
          }
        }
        if (path.endsWith('.node')) {
          return { path, external: true }
        }
      })

      build.onLoad({ filter: /.+/ }, loadModule)
      build.onLoad({ filter: /.+/, namespace: 'virtual' }, args => {
        // args.path = args.path.replace(NULL_BYTE_PLACEHOLDER, '\0')
        return loadModule(args)
      })

      async function loadModule({ path }: esbuild.OnLoadArgs) {
        const transformed = await transform(toDevPath(path, config.root, true))
        if (transformed) {
          let { code, map } = transformed as OutputChunk
          if (map) {
            map.sources = map.sources.map(source => {
              return source ? relative(dirname(path), source) : null!
            })
            code += map ? toInlineSourceMap(map) : ''
          }
          return {
            contents: code,
            loader: 'js' as const,
          }
        }
      }
    },
  }

  const task = startTask(`Bundling routes...`)

  const routeEntryPoints = dedupe(
    Array.from(routeImports.values(), resolved => resolved.file)
  )

  debug(`route entries: %O`, routeEntryPoints)

  const { metafile, outputFiles } = await esbuild.build({
    absWorkingDir: config.root,
    allowOverwrite: true,
    bundle: true,
    entryPoints: [
      virtualRenderPath,
      context.routesPath,
      ...Object.keys(rendererMap),
      ...routeEntryPoints,
    ],
    format: 'esm',
    logLevel: 'error',
    metafile: true,
    outdir: config.root,
    plugins: [bridge],
    target: 'esnext',
    treeShaking: true,
    sourcemap: true,
    splitting: true,
    write: false,
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
  const bundledRoutes: Record<string, OutputChunk> = {}
  const sharedModules: Record<string, OutputChunk> = {}

  const outputs = Object.values(metafile!.outputs)
  for (let i = 1; i < outputFiles.length; i += 2) {
    const map = JSON.parse(outputFiles[i - 1].text) as SourceMap
    const file = outputFiles[i]
    const { entryPoint } = outputs[i]
    resolveMapSources(map, dirname(file.path))
    if (entryPoint) {
      const entryUrl = '/' + entryPoint
      if (entryUrl in entryUrlToFileMap) {
        const filePath = entryUrlToFileMap[entryUrl]
        const bundleId = toBundleChunkId(filePath)
        bundledRoutes[bundleId] = { code: file.text, map }
        bundleToEntryMap[bundleId] = entryUrl
      } else {
        const chunkPath = resolve(config.root, entryPoint)
        sharedModules[chunkPath] = { code: file.text, map }
        bundleToEntryMap[chunkPath] = entryUrl
      }
    } else {
      const chunkId = '.saus' + file.path.slice(config.root.length)
      sharedModules[chunkId] = { code: file.text, map }
    }
  }

  const isolateSsrModule = async (code: string, id: string, ssrId: string) => {
    const hoistedImports = new Set<string>()
    const esmHelpers = new Set<Function>()

    const editor = await compileEsm({
      code,
      filename: id,
      keepImportMeta: true,
      esmHelpers,
      resolveId(id) {
        if (relativePathRE.test(id)) {
          id = id.replace(relativePathRE, '.saus/')
          hoistedImports.add(id)
          return id
        }
        const unresolvedId = isolatedCjsModules.get(id)
        if (unresolvedId) {
          hoistedImports.add(unresolvedId)
        }
      },
    })

    for (const id of hoistedImports) {
      editor.prepend(`import "${id}"\n`)
    }

    if (ssrId == routesUrl) {
      ssrId = ssrRoutesId

      const routeModulePaths = new Set(
        Array.from(routeImports.values(), resolved => resolved.file)
      )
      for (const file of routeModulePaths) {
        editor.prepend(`import "${file}"\n`)
      }
    }

    editor.prependRight(0, `__d("${ssrId}", async (exports) => {\n`)
    editor.append('\n})')

    const esmHelperIds = Array.from(esmHelpers, f => f.name)
    esmHelperIds.unshift(`__d`)
    editor.prepend(`import { ${esmHelperIds.join(', ')} } from "saus/core"\n`)

    return {
      code: editor.toString(),
      map: editor.generateMap({ hires: true }),
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
          `await __requireAsync`
        )

        const importer = id
        resolving.push(
          context.resolve(source, importer).then(resolved => {
            if (!resolved) {
              context.error(
                `Failed to resolve import "${source}" from "${relative(
                  process.cwd(),
                  importer
                )}". Does the file exist?`,
                sourceArg.node.start!
              )
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
    editor.prepend(`import { __d, __requireAsync } from "saus/core"\n`)
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
      if (sharedModules[id]) {
        return id
      }
      const chunkId = toBundleChunkId(id)
      if (bundledRoutes[chunkId]) {
        return chunkId
      }
      if (importer && !sharedModules[importer] && !bundledRoutes[importer]) {
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
      return bundledRoutes[id] || sharedModules[id]
    },
    transform(code, id) {
      if (bundledRoutes[id] || sharedModules[id]) {
        const ssrId = bundleToEntryMap[id] || id
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
        return isolateSsrModule(code, id, ssrId)
      }
      const ssrId = isolatedCjsModules.get(id)
      if (ssrId) {
        return isolateCjsModule(code, id, ssrId, this)
      }
    },
  }
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

type OutputChunk = { code: string; map?: SourceMap }

function isolateRenderers(
  renderPath: string,
  renderModule: OutputChunk,
  virtualRenderPath: string,
  modules: ModuleProvider,
  config: vite.ResolvedConfig
) {
  const rendererMap: Record<string, OutputChunk> = {}
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
        `[${JSON.stringify(func.route)}, () => ssrRequire("${chunkId}")],`
      )
    }
  }

  modules.addModule({
    id: toDevPath(virtualRenderPath, config.root),
    code: endent`
      import { addRenderers, ssrRequire } from "saus/core"

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
): OutputChunk {
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
