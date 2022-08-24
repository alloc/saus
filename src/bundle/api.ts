import { MagicString } from '@/babel'
import { dataToEsm, RuntimeConfig } from '@/core'
import { debug } from '@/debug'
import { resolveGitHubCreds } from '@/git'
import { relativeToCwd } from '@/node/relativeToCwd'
import { servedPathForFile } from '@/node/servedPathForFile'
import { resolveMapSources, SourceMap } from '@/node/sourceMap'
import { bundleDir, clientDir, httpDir } from '@/paths'
import { rewriteHttpImports } from '@/plugins/httpImport'
import { overrideBareImport, redirectModule } from '@/plugins/moduleRedirection'
import { copyPublicDir } from '@/plugins/publicDir'
import { routesPlugin } from '@/plugins/routes'
import { Profiling } from '@/profiling'
import { RouteClient } from '@/routeClients'
import { callPlugins } from '@/utils/callPlugins'
import { serializeImports } from '@/utils/imports'
import { BundleConfig, vite } from '@/vite'
import { writeBundle } from '@/writeBundle'
import arrify from 'arrify'
import builtinModules from 'builtin-modules'
import esModuleLexer from 'es-module-lexer'
import etag from 'etag'
import fs from 'fs'
import kleur from 'kleur'
import path from 'path'
import { BundleContext } from '../bundle'
import { noop } from '../core/utils/noop'
import { compileClients } from './clients'
import { IsolatedModuleMap, isolateRoutes } from './isolateRoutes'
import type { BundleOptions } from './options'
import { preferExternal } from './preferExternal'
import { renderBundleModule } from './renderBundleModule'
import { resolveRouteImports } from './routeImports'
import { injectAppVersionRoute } from './routes/appVersion'
import { injectClientStoreRoute } from './routes/clientStore'
import type { ClientEntries } from './runtime/bundle/clientEntries'
import type { ClientAsset, ClientChunk, OutputBundle } from './types'

export async function bundle(
  context: BundleContext,
  options: BundleOptions = {}
): Promise<OutputBundle> {
  if (options.appVersion !== undefined) {
    injectAppVersionRoute(options.appVersion, context)
  }
  if (context.bundle.clientStore !== 'external') {
    injectClientStoreRoute(context)
  }

  await context.loadRoutes()
  await callPlugins(context.plugins, 'receiveBundleOptions', options)

  const [{ githubRepo, githubToken }, routeImports] = await Promise.all([
    resolveGitHubCreds(context),
    resolveRouteImports(context),
  ])

  const resolved = await context.resolveId(context.defaultLayout.id)
  if (resolved) {
    context.defaultLayout.id = servedPathForFile(resolved.id, context.root)
  }

  const { bundle: bundleConfig, config, userConfig } = context
  const outDir = path.resolve(config.root, config.build.outDir)

  const ssrEntries = [
    ...context.injectedImports.prepend,
    context.routesPath,
    ...context.injectedImports.append,
  ]

  let ssrEntryId: string | undefined
  if (ssrEntries.length > 1) {
    ssrEntryId = '\0ssr-entry.js'
    context.injectedModules.addServerModule({
      id: ssrEntryId,
      code: serializeImports(ssrEntries).join('\n'),
    })
  }

  const runtimeConfig: RuntimeConfig = {
    assetsDir: config.build.assetsDir,
    base: config.base,
    bundleType: bundleConfig.type,
    command: 'bundle',
    debugBase: bundleConfig.debugBase,
    defaultLayout: context.defaultLayout,
    defaultPath: context.defaultPath,
    githubRepo,
    githubToken,
    htmlTimeout: config.saus.htmlTimeout,
    minify: (userConfig.build?.minify ?? config.mode == 'production') !== false,
    mode: config.mode,
    publicDir: path.relative(outDir, config.publicDir),
    renderConcurrency: config.saus.renderConcurrency,
    ssrEntryId:
      ssrEntryId || servedPathForFile(context.routesPath, context.root),
    stateModuleBase: config.saus.stateModuleBase!,
    // These are set by the `compileClients` function.
    clientCacheId: '',
    clientHelpersId: '',
    clientRuntimeId: '',
  }

  await callPlugins(context.plugins, 'onRuntimeConfig', runtimeConfig)

  // Isolate the server modules while bundling the client modules.
  const isolatedModules: IsolatedModuleMap = {}
  const isolatedRoutesPlugin = isolateRoutes(
    context,
    ssrEntryId || context.routesPath,
    routeImports,
    isolatedModules
  )
  // Prevent unhandled rejection crash.
  isolatedRoutesPlugin.catch(noop)

  // Prepare any Vite/Rollup plugins that initialize state before each build.
  await context.buildStart()

  Profiling.mark('generate client modules')
  const { clientRouteMap, clientChunks, clientAssets } = await compileClients(
    context,
    runtimeConfig
  )

  Profiling.mark('generate ssr bundle')
  const { code, map } = await generateSsrBundle(
    ssrEntryId || context.routesPath,
    context,
    options,
    runtimeConfig,
    clientChunks,
    clientAssets,
    clientRouteMap,
    isolatedModules,
    [await isolatedRoutesPlugin]
  )

  // TODO: what about routes with no hydrator?
  const routeEntries = Object.fromEntries(
    Object.entries(clientRouteMap)
      .map(([clientId, entryUrl]) =>
        context.routeClients.routesByClientId[clientId].map(
          (route): [string, string] => [route.path, entryUrl]
        )
      )
      .flat()
  )

  const bundle: OutputBundle = {
    path: bundleConfig.outFile,
    code,
    map: map as SourceMap | undefined,
    files: {},
    appVersion: options.appVersion,
    clientChunks,
    clientAssets,
    routeEntries,
  }

  await callPlugins(context.plugins, 'receiveBundle', bundle, options)

  if (bundle.path && context.bundle.write !== false) {
    context.logger.info(
      kleur.bold('[saus]') +
        ` Saving bundle as ${kleur.green(relativeToCwd(bundle.path))}`
    )
    writeBundle(bundle, outDir, {
      writeIndexTypes: !bundleConfig.entry,
      writeAssets:
        options.forceWriteAssets || bundleConfig.clientStore == 'local',
    })
  }

  return bundle
}

async function generateSsrBundle(
  ssrEntryId: string,
  context: BundleContext,
  options: BundleOptions,
  runtimeConfig: RuntimeConfig,
  clientChunks: ClientChunk[],
  clientAssets: ClientAsset[],
  clientRouteMap: Record<string, string>,
  isolatedModules: IsolatedModuleMap,
  inlinePlugins: vite.PluginOption[]
) {
  const { bundle: bundleConfig, injectedModules } = context

  const clientEntries: ClientEntries = {}
  for (const client of Object.values(
    context.routeClients.clientsById
  ) as RouteClient[]) {
    const clientEntry = clientChunks.find(
      chunk => !chunk.isDebug && chunk.isEntry && client.id in chunk.modules
    )!
    const layoutModuleId = servedPathForFile(
      client.renderer.layoutModuleId,
      context.root,
      true
    )
    const [route] = context.routeClients.routesByClientId[client.id]
    clientEntries[layoutModuleId] ||= {}
    clientEntries[layoutModuleId][route.moduleId!] = clientEntry.fileName
  }

  injectedModules.addServerModule({
    id: path.join(bundleDir, 'bundle/clientEntries.ts'),
    code: dataToEsm(clientEntries),
  })

  if (bundleConfig.clientStore !== 'external') {
    const isInlined = bundleConfig.clientStore == 'inline'
    const assetEntries = clientAssets.map(asset => {
      const content = Buffer.from(asset.source)
      return [
        asset.fileName,
        isInlined ? content.toString('base64') : etag(content, { weak: true }),
      ] as const
    })

    injectedModules.addServerModule({
      id: path.join(bundleDir, 'bundle/clientStore/index.ts'),
      code: `export * from "./${bundleConfig.clientStore}"`,
    })

    injectedModules.addServerModule({
      id: path.join(bundleDir, 'bundle/clientModules.ts'),
      code: dataToEsm(
        clientChunks.reduce((clientModules, chunk) => {
          const value = isInlined
            ? chunk.code
            : etag(chunk.code, { weak: true })

          if (chunk.fileName.endsWith('.js')) {
            clientModules[chunk.fileName] = value
          } else {
            assetEntries.push([chunk.fileName, value])
          }

          return clientModules
        }, {} as typeof import('./runtime/bundle/clientModules').default)
      ),
    })

    injectedModules.addServerModule({
      id: path.join(bundleDir, 'bundle/clientAssets.ts'),
      code: dataToEsm(Object.fromEntries(assetEntries)),
    })
  }

  if (!bundleConfig.debugBase)
    injectedModules.addServerModule({
      id: path.join(bundleDir, 'bundle/debugBase.ts'),
      code: `export function injectDebugBase() {}`,
    })

  injectedModules.addServerModule({
    id: path.join(bundleDir, 'bundle/config.ts'),
    code: dataToEsm(runtimeConfig),
  })

  injectedModules.addServerModule({
    id: context.bundleModuleId,
    code: renderBundleModule(ssrEntryId),
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
        overrideBareImport('debug', path.join(bundleDir, 'bundle/debug.ts'))
    )
  }

  const bundleOutDir = bundleConfig.outFile
    ? path.dirname(bundleConfig.outFile)
    : context.root

  const preferExternalPlugin =
    (options.preferExternal || undefined) && preferExternal(context)

  debug('Resolving "build" config for SSR bundle')
  const config = await context.resolveConfig({
    plugins: [
      context.bundlePlugins,
      ...inlinePlugins,
      injectedModules,
      options.absoluteSources && mapSourcesPlugin(bundleOutDir),
      ...workerPlugins,
      copyPublicDir(),
      routesPlugin(clientRouteMap)(),
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
      conditions: ['ssr'].concat(isWorker ? ['worker'] : []),
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
