import path from 'path'
import { Plugin } from '../core'
import { compileRoutesMap, routeMarker } from '../core/compileRoutesMap'
import { bundleDir, clientDir } from '../core/paths'

const clientRouteMapStubPath = path.join(clientDir, 'routes.ts')
const serverRouteMapStubPath = path.join(bundleDir, 'routes.ts')

/**
 * This plugin extracts the `route` calls from the routes module,
 * so any Node-specific logic is removed for client-side use.
 */
export const routesPlugin = (clientRouteMap?: Record<string, string>) => () => {
  let plugin: Plugin
  return (plugin = {
    name: 'saus:routes',
    enforce: 'pre',
    saus: {
      onContext(context) {
        const isBuild = context.config.command == 'build'

        plugin.load = async function (id) {
          const isClient = id == clientRouteMapStubPath
          if (isClient || id == serverRouteMapStubPath) {
            return compileRoutesMap(
              { isBuild, isClient },
              context,
              this.resolve.bind(this),
              clientRouteMap
            )
          }
        }

        type Chunk = {
          fileName: string
          code: string
          modules: Record<string, any>
        }

        plugin.generateBundle = async function (_, bundle) {
          const chunks = Object.values(bundle).filter(
            chunk => chunk.type == 'chunk'
          ) as Chunk[]

          for (const chunk of chunks) {
            if (chunk.code.includes(routeMarker)) {
              chunk.code = chunk.code.replace(
                new RegExp(routeMarker + '\\("(.+?)"\\)', 'g'),
                (_, routeModuleId) => {
                  let routeChunkUrl =
                    clientRouteMap && clientRouteMap[routeModuleId]
                  if (!routeChunkUrl) {
                    const routeChunk = chunks.find(
                      chunk => chunk.modules[routeModuleId]
                    )
                    if (!routeChunk) {
                      throw Error(`Route chunk not found: "${routeModuleId}"`)
                    }
                    routeChunkUrl = context.basePath + routeChunk.fileName
                    if (clientRouteMap) {
                      clientRouteMap[routeModuleId] = routeChunkUrl
                    }
                  }
                  return `"${routeChunkUrl}"`
                }
              )
            }
          }
        }
      },
    },
  })
}
