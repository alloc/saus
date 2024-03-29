import { vite } from '@/core'
import { createModuleProvider } from '@/plugins/moduleProvider'
import { renderRouteEntry } from '@/routeEntries'
import { getViteFunctions } from '@/vite/functions'
import { codeFrameColumns } from '@babel/code-frame'
import { createFilter } from '@rollup/pluginutils'
import { babel } from '@utils/babel'
import { bareImportRE, relativePathRE } from '@utils/importRegex'
import { MagicString } from '@utils/magic-string'
import { relativeToCwd } from '@utils/node/relativeToCwd'
import { servedPathForFile } from '@utils/node/servedPathForFile'
import {
  loadSourceMap,
  resolveMapSources,
  SourceMap,
} from '@utils/node/sourceMap'
import { plural } from '@utils/plural'
import { compileEsm, exportsId, requireAsyncId } from '@vm/compileEsm'
import { ForceLazyBindingHook } from '@vm/types'
import builtinModules from 'builtin-modules'
import escalade from 'escalade/sync'
import fs from 'fs'
import { bold, yellow } from 'kleur/colors'
import { startTask } from 'misty/task'
import { dirname, relative, resolve } from 'path'
import * as rollup from 'rollup'
import { BundleContext } from './context'
import { findLiveBindings, LiveBinding, matchLiveBinding } from './liveBindings'
import { RouteImports } from './routeImports'

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
  context: BundleContext,
  ssrEntryId: string,
  routeImports: RouteImports,
  isolatedModules: IsolatedModuleMap
): Promise<vite.Plugin> {
  const modules = createModuleProvider({
    serverModules: new Map(context.injectedModules.serverModules),
  })

  const config = await context.resolveConfig({
    resolve: {
      conditions: ['ssr'],
    },
    plugins: [modules, rewriteRouteImports(context.routesPath, routeImports)],
    build: {
      sourcemap: true,
      ssr: true,
      target: 'esnext',
      minify: false,
    },
    esbuild: {
      jsx: 'transform',
    },
  })

  const plugins = config.plugins.filter(p => {
    // CommonJS modules are externalized, so this plugin is just overhead.
    if (p.name == 'commonjs') return false
    // Leave static replacement up to the main build.
    if (p.name == 'vite:define') return false
    // Silence irrelevant logs.
    if (p.name == 'vite:reporter') return false

    return true
  })

  const { external } = context.bundle
  if (external) {
    plugins.unshift({
      name: 'isolateRoutes:external',
      resolveId(id) {
        if (external.some(e => e == id || id.startsWith(e + '/'))) {
          return { id, external: true }
        }
      },
    })
  }

  const pluginContainer = await vite.createPluginContainer({
    ...config,
    plugins,
    ssr: {
      ...config.ssr,
      noExternal: [],
      external: [],
    },
  })

  // Vite and Rollup plugins may initialize internal state
  // within the buildStart hook.
  await pluginContainer.buildStart({})

  const { fetchModule, resolveId } = getViteFunctions(pluginContainer, {
    ssr: true,
  })

  const sausExternalRE = /(^|\/)saus(?!.*\/(packages|examples))\b/
  const nodeModulesRE = /\/node_modules\//

  // Virtual modules are always isolated, if imported.
  const isVirtual = (id: string) => id[0] === '\0'

  // Dependencies can be isolated forcefully.
  const shouldForceIsolate = createFilter(
    context.bundle.isolate || /^$/,
    undefined,
    { resolve: false }
  )

  // Default isolation can be prevented.
  const shouldNotIsolate = createFilter(
    context.bundle.noIsolate || /^$/,
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
      if (sausExternalRE.test(id) || builtinModules.includes(id)) {
        return { id, external: true }
      }
      let forceIsolate = false
      if (bareImportRE.test(id)) {
        if (shouldNotIsolate(id)) {
          return { id, external: true }
        }
        // Modules referenced with "@/" alias prefix are assumed
        // to be project files, so they're isolated unless the
        // `bundle.noIsolate` option happens to match them.
        if (!id.startsWith('@/')) {
          forceIsolate = shouldForceIsolate(id)
          if (!forceIsolate && !shouldResolve(id, importer)) {
            return { id, external: true }
          }
        }
      }
      const resolved = await resolveId(id, importer)
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
        const external =
          !forceIsolate &&
          (!!resolved.external ||
            !id.startsWith(config.root + '/') ||
            nodeModulesRE.test(id.slice(config.root.length)))

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
        var transformed = await fetchModule(id)
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
        let { code, map } = transformed
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

  const rendererIds: string[] = []
  for (const renderer of context.renderers) {
    const rendererId = '\0' + renderer.fileName
    rendererIds.push(rendererId)
    modules.addServerModule({
      id: rendererId,
      code: renderRouteEntry(renderer),
    })
  }

  const task = config.logger.isLogged('info')
    ? startTask(`Bundling routes...`)
    : null

  const bundleInputs = [ssrEntryId, ...rendererIds]

  const isDebug = !!process.env.DEBUG
  const importCycles: string[][] = []
  let hasWarnedCircularImport = false

  const bundle = await rollup.rollup({
    plugins: [bridge],
    input: bundleInputs,
    makeAbsoluteExternalsRelative: false,
    context: 'globalThis',
    onwarn(warning, warn) {
      if (warning.code == 'CIRCULAR_DEPENDENCY') {
        const cycle = warning.cycle!.map(id => resolve(config.root, id))
        importCycles.push(cycle)
        if (isDebug || !hasWarnedCircularImport) {
          if (!hasWarnedCircularImport) {
            context.logger.warn('')
          }
          hasWarnedCircularImport = true
          context.logger.warn(
            bold(`Circular import may lead to unexpected behavior`) +
              '\n  ' +
              yellow(cycle.map(relativeToCwd).join(' → ')) +
              '\n'
          )
        }
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
    preserveModulesRoot: config.root,
  })

  await pluginContainer.close()

  task?.finish(
    `${plural(
      context.renderers.reduce((count, { routes }) => count + routes.length, 0),
      'route'
    )} isolated.`
  )

  const routesUrl = servedPathForFile(context.routesPath, config.root)

  // Rollup changes the file extension of rolled modules to use ".js"
  // and this maps the source paths to their rolled path.
  const rolledModulePaths: Record<string, string> = {}

  for (const chunk of generated.output as rollup.OutputChunk[]) {
    const modulePath = chunk.facadeModuleId!
    const rolledPath = resolve(config.root, chunk.fileName)
    const liveBindings = liveBindingsByChunk.get(chunk)

    const ssrId =
      modulePath[0] == '\0'
        ? modulePath
        : bundleInputs.includes(modulePath)
        ? servedPathForFile(modulePath, config.root, true)
        : toSsrPath(modulePath, config.root)

    const map = chunk.map!
    resolveMapSources(map, dirname(modulePath))

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
      .filter(id => rolledModulePaths[id])
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

    // If a file only contains import statements and has no trailing
    // line break, the `__d` call insertion leads to a syntax error.
    // By inserting a line break here, we can avoid the error.
    if (!code.endsWith('\n')) {
      code += '\n'
    }

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
      for (const id of rendererIds) {
        editor.prepend(`import "${rolledModulePaths[id]}"\n`)
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
    // This lets us take precedence over module injection.
    resolveId(id) {
      return rolledModulePaths[id]
    },
    // This lets us redirect isolated modules after their
    // absolute paths have been resolved.
    async redirectModule(id, importer) {
      const rolledPath = rolledModulePaths[id]
      if (rolledPath) {
        return rolledPath
      }
      if (isolatedModules[id]) {
        return id
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
