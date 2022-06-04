import * as babel from '@babel/core'
import arrify from 'arrify'
import builtinModules from 'builtin-modules'
import esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import kleur from 'kleur'
import { warnOnce } from 'misty'
import path from 'path'
import { getBabelConfig, MagicString, t } from './babel'
import type { ClientModuleMap } from './bundle/types'
import {
  ClientFunction,
  ClientFunctions,
  dataToEsm,
  endent,
  extractClientFunctions,
  unwrapBuffer,
} from './core'
import {
  BundleConfig,
  BundleContext,
  ClientImport,
  generateClientModules,
  IsolatedModuleMap,
  isolateRoutes,
  resolveRouteImports,
} from './core/bundle'
import { preferExternal } from './core/bundle/preferExternal'
import type { RuntimeConfig } from './core/config'
import { debug } from './core/debug'
import { bundleDir, clientDir, httpDir } from './core/paths'
import { vite } from './core/vite'
import { getViteTransform } from './core/viteTransform'
import { BufferLike } from './http/types'
import { debugForbiddenImports } from './plugins/debug'
import { rewriteHttpImports } from './plugins/httpImport'
import { createModuleProvider } from './plugins/moduleProvider'
import { overrideBareImport, redirectModule } from './plugins/moduleRedirection'
import { routesPlugin } from './plugins/routes'
import { Profiling } from './profiling'
import { callPlugins } from './utils/callPlugins'
import { serializeImports } from './utils/imports'
import { md5Hex } from './utils/md5-hex'
import { relativeToCwd } from './utils/relativeToCwd'
import { resolveMapSources, SourceMap } from './utils/sourceMap'
import { toDevPath } from './utils/toDevPath'

export interface BundleOptions {
  absoluteSources?: boolean
  isBuild?: boolean
  minify?: boolean
  preferExternal?: boolean
}

export interface OutputBundle {
  /** Where the bundle is saved to disk. */
  path: string | undefined
  /** This code generates and serves the application. */
  code: string
  /** The collapsed sourcemap for this bundle. */
  map: SourceMap | undefined
  /**
   * These files are written to the `build.outDir` directory, but
   * only if the bundle has a defined `path`. More files can be
   * added by plugins in the `saus.receiveBundle` hook.
   */
  files: Record<string, BufferLike>
  /**
   * The client runtime and any user code; split into "chunks"
   * so that routes only load what they use.
   */
  clientModules: ClientModuleMap
  /**
   * Assets loaded by the client.
   */
  clientAssets: Record<string, Buffer>
}

export async function bundle(
  options: BundleOptions,
  context: BundleContext
): Promise<OutputBundle> {
  const { functions, functionImports, routeImports, runtimeConfig } =
    await prepareFunctions(context)

  const isolatedModules: IsolatedModuleMap = {}

  // Isolate the server routes while bundling client modules.
  const isolatedRoutes = isolateRoutes(context, routeImports, isolatedModules)

  Profiling.mark('generate client modules')
  const { moduleMap, assetMap, clientRouteMap } = await generateClientModules(
    functions,
    functionImports,
    runtimeConfig,
    context,
    options.minify
  )

  // The runtime config isn't ready for plugins until after
  // the `generateClientModules` function promise is fulfilled.
  await callPlugins(context.plugins, 'onRuntimeConfig', runtimeConfig)

  Profiling.mark('generate ssr bundle')
  const { code, map } = await generateSsrBundle(
    context,
    options,
    runtimeConfig,
    functions,
    moduleMap,
    assetMap,
    clientRouteMap,
    isolatedModules,
    [await isolatedRoutes]
  )

  const bundle: OutputBundle = {
    path: context.bundle.outFile,
    code,
    map: map as SourceMap | undefined,
    files: {},
    clientModules: moduleMap,
    clientAssets: assetMap,
  }

  await callPlugins(context.plugins, 'receiveBundle', bundle)

  if (bundle.path) {
    context.logger.info(
      kleur.bold('[saus]') +
        ` Saving bundle as ${kleur.green(relativeToCwd(bundle.path))}`
    )

    fs.mkdirSync(path.dirname(bundle.path), { recursive: true })
    if (bundle.map) {
      fs.writeFileSync(bundle.path + '.map', JSON.stringify(bundle.map))
      bundle.code +=
        '\n//# ' + 'sourceMappingURL=' + path.basename(bundle.path) + '.map'
    }
    fs.writeFileSync(bundle.path, bundle.code)

    if (!context.bundle.entry) {
      fs.copyFileSync(
        path.resolve(__dirname, '../bundle/index.d.ts'),
        bundle.path.replace(/(\.[cm]js)?$/, '.d.ts')
      )
    }

    const outDir = path.resolve(
      context.config.root,
      context.config.build.outDir
    )

    for (let [file, buffer] of Object.entries(bundle.files)) {
      file = path.resolve(outDir, file)
      fs.writeFileSync(file, unwrapBuffer(buffer))
    }

    if (context.bundle.moduleMap == 'external') {
      let file: string
      for (const module of Object.values(moduleMap)) {
        file = path.join(outDir, module.id)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, module.text)
        if (runtimeConfig.debugBase && module.debugText) {
          file = path.join(outDir, runtimeConfig.debugBase, module.id)
          fs.mkdirSync(path.dirname(file), { recursive: true })
          fs.writeFileSync(file, module.debugText)
        }
      }
      for (const assetId in assetMap) {
        file = path.join(outDir, assetId)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, assetMap[assetId])
      }
    }
  }

  return bundle
}

async function prepareFunctions(context: BundleContext) {
  const { root, renderPath, config } = context

  Profiling.mark('parse render functions')
  const functions = extractClientFunctions(renderPath)
  Profiling.mark('transform render functions')

  const functionExt = path.extname(renderPath)
  const functionModules = createModuleProvider()
  const functionImports: { [stmt: string]: ClientImport } = {}

  const { transform, pluginContainer } = await getViteTransform({
    ...config,
    plugins: [functionModules, ...config.plugins],
  })

  const babelConfig = getBabelConfig(renderPath)
  const parseFile = (code: string) =>
    babel.parseSync(code, babelConfig) as t.File
  const parseStmt = <T = t.Statement>(code: string) =>
    parseFile(code).program.body[0] as any as T

  const registerImport = async (code: string, node?: t.ImportDeclaration) => {
    if (functionImports[code]) return

    // Explicit imports have a Babel node parsed from the source file,
    // while implicit imports need their injected code to be parsed.
    const isImplicit = node == null

    if (!node) {
      node = parseStmt(code)!
      if (!t.isImportDeclaration(node)) {
        return warnOnce(`Expected an import declaration`)
      }
    }

    const id = node.source.value

    let resolvedId = (await pluginContainer.resolveId(id, renderPath))?.id
    if (!resolvedId) {
      return warnOnce(`Could not resolve "${id}"`)
    }

    const isRelativeImport = id[0] == '.'
    const inProjectRoot = resolvedId.startsWith(root + '/')

    if (isRelativeImport && !inProjectRoot) {
      return warnOnce(`Relative import "${id}" resolved outside project root`)
    }

    const isVirtual = id === resolvedId || resolvedId[0] === '\0'
    const resolved: ClientImport = {
      id,
      code,
      source: isVirtual
        ? resolvedId
        : inProjectRoot
        ? resolvedId.slice(root.length)
        : `/@fs/${resolvedId}`,
      isVirtual,
      isImplicit,
    }

    if (!isVirtual)
      resolved.code =
        code.slice(0, node.source.start! - node.start!) +
        `"${resolved.source}"` +
        code.slice(node.source.end! - node.start!)

    functionImports[code] = resolved
  }

  const transformFunction = async (fn: ClientFunction) => {
    const functionCode = [
      ...fn.referenced,
      `export default ` + fn.function,
    ].join('\n')

    const functionModule = functionModules.addModule({
      // The function module must be within the project root
      // for some transform plugins to work correctly.
      id: path.join(
        root,
        '.saus/functions',
        md5Hex(functionCode).slice(0, 8) + functionExt
      ),
      code: functionCode,
    })

    const transformResult = await transform('/@fs' + functionModule.id)
    if (transformResult?.code) {
      const [prelude, transformedFn] =
        transformResult.code.split('\nexport default ')

      const referenced: string[] = []
      for (const node of parseFile(prelude).program.body) {
        const code = prelude.slice(node.start!, node.end!)
        referenced.push(code)
        if (t.isImportDeclaration(node)) {
          await registerImport(code, node)
        }
      }

      fn.transformResult = {
        function: transformedFn.replace(/;\n?$/, ''),
        referenced,
      }
    }
  }

  const implicitImports = new Set<string>()

  // The `onHydrate` function is used by every shared client module.
  implicitImports.add(`import { onHydrate as $onHydrate } from "saus/client"`)

  // The `hydrate` function is used by every inlined client module.
  implicitImports.add(`import { hydrate } from "saus/client"`)

  // Renderer packages often import modules that help with hydrating the page.
  for (const { imports } of config.saus.clients || []) {
    serializeImports(imports).forEach(stmt => implicitImports.add(stmt))
  }

  const routeImports = await resolveRouteImports(context, pluginContainer)

  // Every route has a module imported by the inlined client module.
  for (const { url } of routeImports.values()) {
    implicitImports.add(`import * as routeModule from "${url}"`)
  }

  await Promise.all<any>([
    ...Array.from(implicitImports, stmt => registerImport(stmt)),
    ...functions.beforeRender.map(transformFunction),
    ...functions.render.map(renderFn =>
      Promise.all([
        transformFunction(renderFn),
        renderFn.didRender && transformFunction(renderFn.didRender),
      ])
    ),
  ])

  await pluginContainer.close()

  const outDir = path.resolve(config.root, config.build.outDir)
  const runtimeConfig: RuntimeConfig = {
    assetsDir: config.build.assetsDir,
    base: config.base,
    bundleType: context.bundle.type,
    command: 'bundle',
    debugBase: context.bundle.debugBase,
    defaultPath: context.defaultPath,
    delayModulePreload: config.saus.delayModulePreload,
    htmlTimeout: config.saus.htmlTimeout,
    mode: config.mode,
    publicDir: path.relative(outDir, config.publicDir),
    renderConcurrency: config.saus.renderConcurrency,
    ssrRoutesId: toDevPath(context.routesPath, config.root, true),
    stripLinkTags: config.saus.stripLinkTags,
    // These are set by the `generateClientModules` function.
    minify: false,
    stateCacheId: '',
  }

  // The functions are now transpiled to plain JavaScript.
  functions.filename = path.basename(
    functions.filename.replace(/\.[^.]+$/, '.js')
  )

  return {
    functions,
    functionImports,
    implicitImports,
    routeImports,
    runtimeConfig,
  }
}

async function generateSsrBundle(
  context: BundleContext,
  options: BundleOptions,
  runtimeConfig: RuntimeConfig,
  functions: ClientFunctions,
  moduleMap: ClientModuleMap,
  assetMap: Record<string, Buffer>,
  clientRouteMap: Record<string, string>,
  isolatedModules: IsolatedModuleMap,
  inlinePlugins: vite.PluginOption[]
) {
  const bundleConfig = context.bundle
  const modules = createModuleProvider()

  modules.addModule({
    id: path.join(bundleDir, 'functions.ts'),
    code: serializeClientFunctions(functions),
  })

  const inlinedAssets = Object.entries(assetMap).map(
    ([id, data]) => [id, data.toString('base64')] as const
  )

  modules.addModule({
    id: path.join(bundleDir, 'inlinedModules.ts'),
    code: dataToEsm(
      Object.values(moduleMap).reduce(
        (moduleMap, { id, text, debugText, ...props }) => {
          if (id.endsWith('.js')) {
            moduleMap[id] = props as any
            if (bundleConfig.moduleMap !== 'external') {
              Object.assign(props, { text, debugText })
            }
          } else {
            inlinedAssets.push([id, text])
          }
          return moduleMap
        },
        {} as typeof import('./bundle/inlinedModules').default
      )
    ),
  })

  modules.addModule({
    id: path.join(bundleDir, 'inlinedAssets.ts'),
    code: dataToEsm(Object.fromEntries(inlinedAssets)),
  })

  modules.addModule({
    id: path.join(bundleDir, 'moduleMap.ts'),
    code: dataToEsm(
      Object.keys(moduleMap).reduce((moduleIds, key) => {
        if (key !== moduleMap[key].id) {
          moduleIds[key] = moduleMap[key].id
        }
        return moduleIds
      }, {} as typeof import('./bundle/moduleMap').default)
    ),
  })

  if (!bundleConfig.debugBase)
    modules.addModule({
      id: path.join(bundleDir, 'debugBase.ts'),
      code: `export function injectDebugBase() {}`,
    })

  const runtimeConfigModule = modules.addModule({
    id: path.join(bundleDir, 'runtimeConfig.ts'),
    code: dataToEsm(runtimeConfig),
  })

  const pluginImports = new Set<string>()
  for (const plugin of context.plugins) {
    if (plugin.fetchBundleImports) {
      const imports = await plugin.fetchBundleImports(modules)
      imports?.forEach(source => pluginImports.add(source))
    }
  }

  const runtimeId = `/@fs/${path.join(bundleDir, 'main.ts')}`
  modules.addModule({
    id: context.bundleModuleId,
    code: endent`
      ${serializeImports(Array.from(pluginImports))}
      import "${context.renderPath}"
      import "${context.routesPath}"

      export * from "${runtimeId}"
      export { default } from "${runtimeId}"
      export { default as config } from "${runtimeConfigModule.id}"
    `,
    moduleSideEffects: 'no-treeshake',
  })

  // Avoid using Node built-ins for `get` function.
  const isWorker = bundleConfig.type == 'worker'
  const workerPlugins: vite.PluginOption[] = []
  if (isWorker) {
    workerPlugins.push(
      redirectModule(
        path.join(httpDir, 'get.ts'),
        path.join(clientDir, 'http/get.ts')
      ),
      // Redirect the `debug` package to a stub module.
      !options.isBuild &&
        overrideBareImport('debug', path.join(bundleDir, 'debug.ts'))
    )
  }

  const bundleOutDir = bundleConfig.outFile
    ? path.dirname(bundleConfig.outFile)
    : context.root

  const preferExternalPlugin =
    (options.preferExternal || undefined) && preferExternal(context)

  debug('Resolving "build" config for SSR bundle')
  const config = await context.resolveConfig('build', {
    plugins: [
      options.absoluteSources && mapSourcesPlugin(bundleOutDir),
      ...inlinePlugins,
      ...workerPlugins,
      routesPlugin(clientRouteMap)(),
      context.bundlePlugins,
      modules,
      debugForbiddenImports([
        'vite',
        './babel/index.js',
        './client/index.js',
        './src/babel/index.ts',
        './src/client/index.ts',
        './src/core/index.ts',
        './src/core/context.ts',
      ]),
      preferExternalPlugin,
      defineNodeConstants(),
      rewriteHttpImports(context.logger, isWorker),
      bundleConfig.entry &&
      bundleConfig.type == 'script' &&
      !supportTopLevelAwait(bundleConfig)
        ? wrapAsyncInit()
        : null,
      // debugSymlinkResolver(),
    ],
    resolve: {
      conditions: isWorker ? ['worker'] : undefined,
    },
    build: {
      write: false,
      target: bundleConfig.target || 'node14',
      minify: bundleConfig.minify == true,
      sourcemap: context.userConfig.build?.sourcemap ?? true,
      rollupOptions: {
        input: bundleConfig.entry || context.bundleModuleId,
        output: {
          dir: bundleOutDir,
          format: bundleConfig.format,
        },
        context: 'globalThis',
        makeAbsoluteExternalsRelative: false,
        external: preferExternalPlugin
          ? (id, _importer, isResolved) => {
              if (!isResolved) return
              if (isolatedModules[id]) return
              if (!path.isAbsolute(id)) return
              if (fs.existsSync(id)) {
                const { external, msg } = preferExternalPlugin.isExternal(id)
                if (msg && !!process.env.DEBUG) {
                  const relativeId = path
                    .relative(context.root, id)
                    .replace(/^([^.])/, './$1')
                  debug(relativeId)
                  debug((external ? kleur.green : kleur.yellow)(`  ${msg}`))
                }
                return external
              }
            }
          : id => {
              return builtinModules.includes(id)
            },
      },
    },
  })

  if (!options.preferExternal) {
    config.ssr!.noExternal = /./
    config.ssr!.external = bundleConfig.external
  }

  const buildResult = (await vite.build(config)) as vite.ViteBuild
  const bundle = buildResult.output[0].output[0]

  return bundle
}

function mapSourcesPlugin(outDir: string): vite.Plugin {
  return {
    name: 'saus:mapSources',
    enforce: 'pre',
    generateBundle(_, chunks) {
      for (const chunk of Object.values(chunks)) {
        if (chunk.type == 'asset') continue
        if (chunk.map) {
          resolveMapSources(chunk.map, outDir)
        }
      }
    },
  }
}

function defineNodeConstants(): vite.Plugin {
  return {
    name: 'saus:defineNodeConstants',
    transform(code, id) {
      if (id.includes('/node_modules/')) {
        return
      }
      const constants: any = {
        __filename: JSON.stringify(id),
        __dirname: JSON.stringify(path.dirname(id)),
      }
      let matched = false
      let matches = new RegExp(
        `\\b(${Object.keys(constants).join('|')})\\b`,
        'g'
      )
      code = code.replace(matches, name => {
        matched = true
        return constants[name]
      })
      if (matched) {
        return { code, map: { mappings: '' } }
      }
    },
  }
}

/**
 * The renderers from the `saus.render` module are transformed at build time
 * for client-side use, so the SSR bundle can serve them from memory as-is.
 *
 * This function prepares a manifest for piecing together a hydration script
 * based on which renderer is used for a given page.
 */
const serializeClientFunctions = (functions: ClientFunctions) =>
  dataToEsm({
    filename: functions.filename,
    beforeRender: functions.beforeRender.map(serializeClientFunction),
    render: functions.render.map(renderFn => ({
      ...serializeClientFunction(renderFn),
      didRender: renderFn.didRender
        ? serializeClientFunction(renderFn.didRender)
        : undefined,
    })),
  })

const serializeClientFunction = (func: ClientFunction) => ({
  start: func.start,
  route: func.route,
  ...func.transformResult,
})

// Technically, top-level await is available since Node 14.8 but Esbuild
// complains when this feature is used with a "node14" target environment.
function supportTopLevelAwait(bundleConfig: BundleConfig) {
  return (
    !bundleConfig.target ||
    arrify(bundleConfig.target).some(
      target => target.startsWith('node') && Number(target.slice(4)) >= 15
    )
  )
}

/**
 * Wrap the entire SSR bundle with an async IIFE, so top-level await
 * is possible in Node 14 and under.
 */
function wrapAsyncInit(): vite.Plugin {
  return {
    name: 'saus:wrapAsyncInit',
    enforce: 'pre',
    renderChunk(code) {
      const editor = new MagicString(code)

      const imports = esModuleLexer.parse(code)[0]
      const lastImportEnd = imports[imports.length - 1]?.se || 0
      const semiPrefix = code[lastImportEnd - 1] == ';' ? '' : ';'
      editor.appendRight(lastImportEnd, `\n${semiPrefix}(async () => {`)
      editor.append(`\n})()`)

      return {
        code: editor.toString(),
        map: editor.generateMap({ hires: true }),
      }
    },
  }
}
