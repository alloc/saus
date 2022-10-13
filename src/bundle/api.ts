import { resolveGitHubCreds } from '@/git'
import { replaceRouteMarkers } from '@/plugins/routes'
import { RouteClient } from '@/routeClients'
import { writeBundle } from '@/writeBundle'
import { RuntimeConfig } from '@runtime/config'
import { serializeImports } from '@runtime/imports'
import { callPlugins } from '@utils/callPlugins'
import { relativeToCwd } from '@utils/node/relativeToCwd'
import { servedPathForFile } from '@utils/node/servedPathForFile'
import { SourceMap } from '@utils/node/sourceMap'
import { noop } from '@utils/noop'
import etag from 'etag'
import kleur from 'kleur'
import path from 'path'
import { BundleContext } from '../bundle/context'
import { ClientData, compileClients } from './clients'
import { IsolatedModuleMap, isolateRoutes } from './isolateRoutes'
import type { BundleOptions } from './options'
import { resolveRouteImports } from './routeImports'
import { injectAppVersionRoute } from './routes/appVersion'
import { injectClientStoreRoute } from './routes/clientStore'
import type { ClientEntries } from './runtime/bundle/clientEntries'
import { compileServerBundle } from './ssrBundle'
import type { ClientChunk, OutputBundle } from './types'

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

  // Build the client bundle in parallel with the server bundle.
  const pendingClientData = compileClients(context, runtimeConfig)
  const pendingServerBundle = compileServerBundle(
    ssrEntryId || context.routesPath,
    context,
    options,
    isolatedModules,
    [await isolatedRoutesPlugin]
  )

  let [clientData, { code, map }] = await Promise.all([
    pendingClientData,
    pendingServerBundle,
  ] as const)

  // Inject client data into the server bundle.
  code = injectClientData(code, clientData, runtimeConfig, context)

  // Replace route markers in client route map.
  code = replaceRouteMarkers(code, context.routeClients)

  const bundle: OutputBundle = {
    path: bundleConfig.outFile,
    code,
    map: map as SourceMap | undefined,
    files: {},
    appVersion: options.appVersion,
    clientChunks: clientData.chunks,
    clientAssets: clientData.assets,
    routeEntries: getRouteEntries(context),
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

function injectClientData(
  code: string,
  { chunks, assets, styles }: ClientData,
  runtimeConfig: RuntimeConfig,
  context: BundleContext
) {
  const clientAssets =
    {} as typeof import('./runtime/bundle/clientAssets').default
  const clientModules =
    {} as typeof import('./runtime/bundle/clientModules').default

  const { clientStore } = context.bundle
  if (clientStore !== 'external') {
    const isInlined = clientStore == 'inline'

    assets.forEach(asset => {
      const content = Buffer.from(asset.source)
      clientAssets[asset.fileName] = isInlined
        ? content.toString('base64')
        : etag(content, { weak: true })
    })

    chunks.forEach(chunk => {
      const mappings = chunk.fileName.endsWith('.js')
        ? clientModules
        : clientAssets

      mappings[chunk.fileName] = isInlined
        ? chunk.code
        : etag(chunk.code, { weak: true })
    })
  }

  const injected: any = {
    sausClientAssets: clientAssets,
    sausClientEntries: getClientEntries(chunks, context),
    sausClientModules: clientModules,
    sausClientStyles: styles,
    sausRuntimeConfig: runtimeConfig,
  }

  const injectedRE = new RegExp(
    '\\bglobalThis\\.(' + Object.keys(injected).join('|') + ')\\b',
    'g'
  )

  return code.replace(injectedRE, (_, key) => {
    const value: any = injected[key]
    if (value !== undefined) {
      // Sadly can't use `dataToEsm` here, because it would mess with
      // the sourcemap line mappings.
      return JSON.stringify(value)
    }
    throw Error('missing client data: ' + key)
  })
}

function getClientEntries(chunks: ClientChunk[], context: BundleContext) {
  const clientEntries: ClientEntries = {}
  for (const client of Object.values(
    context.routeClients.clientsById
  ) as RouteClient[]) {
    const clientEntry = chunks.find(
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
  return clientEntries
}

function getRouteEntries({ routeClients, basePath }: BundleContext) {
  // TODO: what about routes with no hydrator?
  const routeEntries: Record<string, string> = {}
  for (const [clientId, routes] of Object.entries(
    routeClients.routesByClientId
  )) {
    const client = routeClients.clientsById[clientId]
    if (client?.chunk) {
      for (const route of routes) {
        routeEntries[route.path] = basePath + client.chunk.fileName
      }
    }
  }
  return routeEntries
}
