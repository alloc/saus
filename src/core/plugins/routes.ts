import path from 'path'
import { compileRoutesMap, routeMarker } from '../compileRoutesMap'
import { bundleDir, clientDir } from '../paths'
import { Plugin } from '../vite'

const clientRouteMapStubPath = path.join(clientDir, 'routes.ts')
const serverRouteMapStubPath = path.join(bundleDir, 'bundle/routes.ts')

/**
 * This plugin extracts the `route` calls from the routes module,
 * so any Node-specific logic is removed for client-side use.
 */
export const routesPlugin =
  (clientRouteMap?: Record<string, string>) => (): Plugin => {
    return {
      name: 'saus:routes',
      enforce: 'pre',
      saus(context, config) {
        const isBuild = config.command == 'build'
        const ssr = !!config.build.ssr

        this.load = id => {
          const isClient = id == clientRouteMapStubPath
          if (isClient || id == serverRouteMapStubPath) {
            return compileRoutesMap({ ssr, isBuild, isClient }, context)
          }
        }

        type Chunk = {
          fileName: string
          code: string
          modules: Record<string, any>
          isEntry: boolean
        }

        this.generateBundle = async function (_, bundle) {
          const chunks = Object.values(bundle).filter(
            chunk => chunk.type == 'chunk'
          ) as Chunk[]

          for (const chunk of chunks) {
            if (chunk.modules[clientRouteMapStubPath]) {
              chunk.code = chunk.code.replace(
                new RegExp(routeMarker + '\\("(.+?)"\\)', 'g'),
                (_, routeClientId) => {
                  // Babel escapes null byte, so we have to unescape it.
                  routeClientId = routeClientId.replace('\\0', '\0')

                  let routeChunkUrl =
                    clientRouteMap && clientRouteMap[routeClientId]

                  if (!routeChunkUrl) {
                    const routeChunk = chunks.find(
                      chunk => chunk.isEntry && chunk.modules[routeClientId]
                    )
                    if (!routeChunk) {
                      throw Error(`Route chunk not found: "${routeClientId}"`)
                    }
                    routeChunkUrl = routeChunk.fileName
                    if (clientRouteMap) {
                      clientRouteMap[routeClientId] = routeChunkUrl
                    }
                  }

                  if (ssr) {
                    routeChunkUrl = context.basePath + routeChunkUrl
                  }

                  return `"${routeChunkUrl}"`
                }
              )
            }
          }
        }
      },
    }
  }
