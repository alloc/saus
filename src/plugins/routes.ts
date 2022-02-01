import fs from 'fs'
import path from 'path'
import { warn } from 'misty'
import { babel, getBabelConfig, t } from '../babel'
import { Plugin, SausConfig } from '../core'
import { clientDir, runtimeDir } from '../bundle/constants'

const clientRouteMapStubPath = path.join(clientDir, 'routes.ts')
const serverRouteMapStubPath = path.join(runtimeDir, 'routes.ts')
const coreRuntimePath = path.join(runtimeDir, 'core.ts')
const routeMarker = '__sausRoute'

/**
 * This plugin extracts the `route` calls from the routes module,
 * so any Node-specific logic is removed for client-side use.
 */
export function routesPlugin(
  { routes: routesPath }: SausConfig,
  clientRouteMap?: Record<string, string>
): Plugin {
  let plugin: Plugin
  return (plugin = {
    name: 'saus:routes',
    enforce: 'pre',
    saus: {
      onContext(context) {
        const isBuild = context.config.command == 'build'

        plugin.load = async function (id, ssr) {
          const isClientMap = id == clientRouteMapStubPath
          const isServerMap = !isClientMap && id == serverRouteMapStubPath

          if (isClientMap || isServerMap) {
            const routesModule = babel.parseSync(
              fs.readFileSync(routesPath, 'utf8'),
              getBabelConfig(routesPath)
            )!

            let defaultRoute: string | undefined
            let unresolvedRoutes: [string, string][] = []

            babel.traverse(routesModule, {
              CallExpression: path => {
                const callee = path.get('callee')
                if (callee.isIdentifier({ name: 'route' })) {
                  let [firstArg, importFn] = path.node.arguments as [
                    t.StringLiteral | t.ArrowFunctionExpression,
                    t.ArrowFunctionExpression
                  ]

                  let routePath: string | undefined
                  if (t.isArrowFunctionExpression(firstArg)) {
                    importFn = firstArg
                  } else {
                    routePath = context.basePath + firstArg.value.slice(1)
                  }

                  const routeModuleId = (
                    (importFn.body as t.CallExpression)
                      .arguments[0] as t.StringLiteral
                  ).value

                  if (routePath) {
                    unresolvedRoutes.push([routePath, routeModuleId])
                  } else {
                    defaultRoute = routeModuleId
                  }
                }
              },
            })

            if (defaultRoute) {
              unresolvedRoutes.push(['default', defaultRoute])
            }

            const routePaths = new Set<string>()
            const resolvedRoutes: t.ObjectProperty[] = []

            await Promise.all(
              unresolvedRoutes
                .reverse()
                .map(async ([routePath, routeModuleId]) => {
                  // Protect against duplicate route paths.
                  if (routePaths.has(routePath)) return
                  routePaths.add(routePath)

                  let resolvedId =
                    clientRouteMap && clientRouteMap[routeModuleId]
                  if (!resolvedId) {
                    const resolved = await this.resolve(
                      routeModuleId,
                      routesPath
                    )
                    if (!resolved) {
                      return warn(`Failed to resolve route: "${routeModuleId}"`)
                    }
                    resolvedId = resolved.id
                    if (clientRouteMap) {
                      clientRouteMap[routeModuleId] = resolvedId
                    }
                  }

                  let propertyValue: t.Expression
                  if (isBuild) {
                    // For the server-side route map, the route is mapped to
                    // a dev URL, since the SSR module system uses that.
                    if (isServerMap) {
                      propertyValue = t.stringLiteral(
                        '/' + path.relative(context.root, resolvedId)
                      )
                    }
                    // For the client-side route map, the resolved module path
                    // must be mapped to the production chunk created by Rollup.
                    // To do this, we use a placeholder `__sausRoute` call which
                    // is replaced in the `generateBundle` plugin hook.
                    else {
                      propertyValue = t.callExpression(
                        t.identifier(routeMarker),
                        [t.stringLiteral(resolvedId)]
                      )
                    }
                  } else {
                    // In dev mode, the route mapping points to a dev URL.
                    propertyValue = t.stringLiteral(
                      context.basePath +
                        (resolvedId.startsWith(context.root + '/')
                          ? resolvedId.slice(context.root.length + 1)
                          : '@fs/' + resolvedId)
                    )
                  }

                  resolvedRoutes.push(
                    t.objectProperty(t.stringLiteral(routePath), propertyValue)
                  )
                })
            )

            const transformer: babel.Visitor = {
              ObjectExpression(path) {
                path.node.properties.push(...resolvedRoutes)
              },
            }

            let template = `export default {}`
            if (isServerMap) {
              template =
                `import { ssrRequire } from "/@fs/${coreRuntimePath}"\n` +
                template
            }

            const result = babel.transformSync(template, {
              plugins: [{ visitor: transformer }],
            }) as { code: string }

            return result
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
