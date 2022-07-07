import { BundleContext, SausContext } from '@/context'
import { findPackage } from '@/node/findPackage'
import { toInlineSourceMap } from '@/node/sourceMap'
import { clientDir, globalCachePath } from '@/paths'
import { clientContextPlugin } from '@/plugins/clientContext'
import { clientLayoutPlugin } from '@/plugins/clientLayout'
import { clientStatePlugin } from '@/plugins/clientState'
import { debugForbiddenImports } from '@/plugins/debug'
import { rewriteHttpImports } from '@/plugins/httpImport'
import { createModuleProvider } from '@/plugins/moduleProvider'
import { moduleRedirection } from '@/plugins/moduleRedirection'
import { routesPlugin } from '@/plugins/routes'
import { clientPreloadsMarker } from '@/routeClients'
import { RuntimeConfig } from '@/runtime/config'
import { prependBase } from '@/utils/base'
import { dataToEsm } from '@/utils/dataToEsm'
import { vite } from '@/vite'
import endent from 'endent'
import path from 'path'
import posixPath from 'path/posix'
import { clientRedirects } from './moduleRedirects'
import { ClientAsset, ClientChunk } from './types'

type OutputArray = vite.RollupOutput['output']
type OutputChunk = OutputArray[0]
type OutputAsset = Exclude<OutputArray[number], OutputChunk>

export async function compileClients(
  context: BundleContext,
  runtimeConfig: RuntimeConfig
) {
  let {
    bundle: { debugBase = '' },
    config,
    userConfig,
  } = context

  const { clientsById, routesByClientId } = context.routeClients

  const modules = createModuleProvider()
  const entryPaths: string[] = []
  await Promise.all(
    Object.entries(clientsById).map(async ([id, client]) => {
      let code: string | null
      if (client && (code = await client.promise)) {
        modules.addModule({ id, code })
        entryPaths.push(id)
      }
    })
  )

  const clientHelpersEntry = path.join(clientDir, 'helpers.ts')
  entryPaths.push('/@fs/' + clientHelpersEntry)

  const clientRuntimeEntry = path.join(clientDir, 'index.ts')
  entryPaths.push('/@fs/' + clientRuntimeEntry)

  let sourceMaps = userConfig.build?.sourcemap
  if (sourceMaps === true || sourceMaps === 'hidden') {
    sourceMaps = false
    context.logger.warn(
      '`sourceMaps: ' +
        JSON.stringify(sourceMaps) +
        '` is not supported for SSR bundles; use "inline" instead.'
    )
  } else if (config.mode !== 'production') {
    sourceMaps ??= 'inline'
  }

  const { base, minify } = runtimeConfig
  const terser = minify ? await import('terser') : null!
  debugBase = debugBase.replace('/', base)

  const outDir = config.build.outDir
  const clientRouteMap: Record<string, string> = {}
  const splitVendor = vite.splitVendorChunk({})

  const entryFilePattern = path.join(config.build.assetsDir, 'entry.[hash].js')
  const chunkFilePattern = path.join(config.build.assetsDir, 'chunk.[hash].js')
  const assetFilePattern = path.join(
    config.build.assetsDir,
    'chunk.[hash].[ext]'
  )

  // debug('Resolving "build" config for client bundle')
  config = await context.resolveConfig({
    plugins: [
      debugForbiddenImports([
        'vite',
        './src/core/index.ts',
        './src/core/context.ts',
      ]),
      modules,
      moduleRedirection(clientRedirects),
      routesPlugin(clientRouteMap)(),
      rewriteHttpImports(context.logger, true),
      // ssrLayoutPlugin(),
      clientLayoutPlugin(),
      clientContextPlugin(),
      clientStatePlugin(),
    ],
    css: {
      minify,
    },
    build: {
      ssr: false,
      write: false,
      minify: false,
      sourcemap: debugBase ? 'inline' : sourceMaps,
      rollupOptions: {
        input: entryPaths,
        output: {
          dir: outDir,
          minifyInternalExports: false,
          entryFileNames: entryFilePattern,
          chunkFileNames: chunkFilePattern,
          assetFileNames: assetFilePattern,
          manualChunks(id, api) {
            // Ensure a chunk exporting the `globalCache` object exists.
            if (id == globalCachePath) {
              return 'cache'
            }
            return splitVendor(id, api)
          },
        },
        preserveEntrySignatures: 'allow-extension',
      },
    },
  })

  const buildResult = (await vite.build(config)) as vite.ViteBuild
  const { output } = buildResult.output[0]

  const fileMap: Record<string, OutputChunk | OutputAsset> = {}
  const assets = output.filter(chunk => chunk.type == 'asset') as OutputAsset[]
  const chunks = output.filter(chunk => chunk.type == 'chunk') as OutputChunk[]

  for (const asset of assets) {
    if (asset.source) {
      fileMap[asset.fileName] = asset
    }
  }

  const baseUrlPath = path.join(clientDir, 'baseUrl.ts')
  const staticRoutesPath = path.join(clientDir, 'routes.ts')

  const debugChunks: Record<string, string> = {}
  const createDebugChunk = (chunk: OutputChunk) => {
    let debugText = chunk.code
    if (baseUrlPath in chunk.modules) {
      debugText = debugText
        .replace(/isDebug = false/, 'isDebug = true')
        .replace(
          /\b(BASE_URL = )"[^"]+"/,
          (_, assign) => assign + JSON.stringify(debugBase)
        )
    } else if (staticRoutesPath in chunk.modules) {
      chunk.code = useDebugRoutes(chunk.code, base, debugBase)
    }
    const map = chunk.map
    if (map) {
      if (map.sources.length) {
        const chunkDir = path.join(outDir, path.dirname(chunk.fileName))
        map.sources = rewriteSources(map.sources, chunkDir, context)
      }
      debugText += toInlineSourceMap(map)
    }
    debugChunks[chunk.fileName] = debugText
  }

  const internalEntryToRuntimeKey = {
    [globalCachePath]: 'clientCacheId',
    [clientHelpersEntry]: 'clientHelpersId',
    [clientRuntimeEntry]: 'clientRuntimeId',
  } as const

  const entryChunks: OutputChunk[] = []
  for (const chunk of chunks) {
    fileMap[chunk.fileName] = chunk

    const isInternalEntry = !!Object.entries(internalEntryToRuntimeKey).find(
      ([clientPath, runtimeKey]) => {
        if (clientPath in chunk.modules) {
          runtimeConfig[runtimeKey] = chunk.fileName
          return true
        }
      }
    )

    createDebugChunk(chunk)
    if (chunk.isEntry && !isInternalEntry) {
      entryChunks.push(chunk)
    }

    // Restore imports that Vite removed, unless the imported
    // module is empty because of Rollup optimizations.
    const importedAssets = [...chunk.importedAssets, ...chunk.importedCss]
    importedAssets.forEach(
      fileName => fileName in fileMap && chunk.imports.push(fileName)
    )

    if (minify) {
      const minified = await terser.minify(chunk.code, {
        toplevel: chunk.exports.length > 0,
        keep_fnames: true,
        keep_classnames: true,
        sourceMap: !!sourceMaps,
      })
      if (chunk.map && minified.map) {
        chunk.map = vite.combineSourcemaps(chunk.fileName, [
          minified.map as any,
          chunk.map as any,
        ]) as any
      }
      chunk.code = minified.code!
    }
    // if (chunk.map) {
    //   chunk.code += toInlineSourceMap(chunk.map)
    // }
  }

  const createPreloadList = (entryChunk: OutputChunk) => {
    const seen = new Set<OutputChunk>()
    const preloads = new Set<string>()
    const preloadChunk = (chunk: OutputChunk) => {
      seen.add(chunk)
      for (const fileName of chunk.imports) {
        preloads.add(fileName)

        const imported = fileMap[fileName]
        if (imported.type == 'chunk' && !seen.has(imported)) {
          preloadChunk(imported)
        }
      }
    }
    preloadChunk(entryChunk)
    return Array.from(preloads)
  }

  const helpersModuleUrl = prependBase(
    runtimeConfig.clientHelpersId,
    context.basePath
  )

  for (const entryChunk of entryChunks) {
    if (Object.keys(entryChunk.modules).some(id => id in routesByClientId)) {
      const preloads = createPreloadList(entryChunk)
      const preloadImport = `import {preloadModules} from "${helpersModuleUrl}"`
      const preloadCall = `preloadModules(${dataToEsm(preloads, '')})`
      entryChunk.code = entryChunk.code.replace(
        clientPreloadsMarker,
        `${preloadImport};${preloadCall}`
      )
      const name = entryChunk.fileName
      if (name in debugChunks) {
        debugChunks[name] = debugChunks[name].replace(
          clientPreloadsMarker,
          endent`
            ${preloadImport}
            ${preloadCall}
          `
        )
      }
    }
  }

  const clientChunks: ClientChunk[] = chunks
  if (debugBase) {
    const debugDir = context.bundle.debugBase!.slice(1)
    Object.entries(debugChunks).forEach(([fileName, code]) => {
      clientChunks.push({
        fileName: debugDir + fileName,
        code,
        isEntry: (fileMap[fileName] as OutputChunk).isEntry,
        isDebug: true,
      })
    })
  }

  return {
    clientAssets: assets as ClientAsset[],
    clientChunks,
    clientRouteMap,
  }
}

/**
 * Rewrite the static `routes` object to use the debug view.
 */
function useDebugRoutes(code: string, base: string, debugBase: string) {
  return code.replace(/\b(routes = )(\{[\s\S]*?})/, (_, assign, routesJson) => {
    const routes: Record<string, string> = JSON.parse(routesJson)
    const newRoutes: Record<string, string> = {}
    for (let routePath in routes) {
      let routeModuleId = routes[routePath]
      if (routeModuleId.startsWith(base)) {
        routeModuleId = routeModuleId.replace(base, debugBase)
      }
      if (routePath.startsWith(base)) {
        routePath = routePath.replace(base, debugBase)
      }
      newRoutes[routePath] = routeModuleId
    }
    return assign + JSON.stringify(newRoutes, null, 2)
  })
}

/**
 * Make sourcemap sources more useful by injecting the package name/version
 * for external modules and by rewriting paths for project files to be relative
 * to the project root.
 */
function rewriteSources(
  sources: string[],
  chunkDir: string,
  context: Pick<SausContext, 'config' | 'root'>
) {
  const chunkDepth = chunkDir.split('/').length - 1
  const publicDir = '/' + (context.config.publicDir || 'public') + '/'

  return sources.map(sourcePath => {
    const sourceDepth = sourcePath.startsWith('@/')
      ? sourcePath.replace(/\/[^./].+$/, '').split('/').length
      : 0

    // Handle imports of public files.
    if (sourceDepth == chunkDepth) {
      return publicDir + sourcePath.replace(/^(\.\.\/)+/, '')
    }

    sourcePath = path.resolve(chunkDir, sourcePath)
    let sourceId = vite.normalizePath(path.relative(context.root, sourcePath))
    if (sourceId[0] == '.' || sourceId.includes('/node_modules/')) {
      const pkgPath = findPackage(path.dirname(sourcePath))
      if (pkgPath) {
        const pkg = require(pkgPath)
        sourceId = posixPath.join(
          pkg.name + '@' + pkg.version,
          slash(path.relative(path.dirname(pkgPath), sourcePath))
        )
      } else {
        // No "package.json" was found, so just remove the "@/" parts.
        sourceId = sourceId.replace(/^(\.\.\/)+/, '')
      }
      return '/node_modules/' + sourceId
    }
    return '/' + sourceId
  })
}

function slash(p: string): string {
  return p.replace(/\\/g, '/')
}
