import fs from 'fs'
import path from 'path'
import { warn } from 'misty'
import { babel, getBabelConfig, t } from '../babel'
import { Plugin, SausConfig } from '../core'
import { clientDir } from '../bundle/constants'

const routeMapStubPath = path.join(clientDir, 'routes.ts')
const routeMarker = '__sausRoute'

/**
 * This plugin extracts the `route` calls from the routes module,
 * so any Node-specific logic is removed for client-side use.
 */
export function routesPlugin({ routes: routesPath }: SausConfig): Plugin {
  let plugin: Plugin
  return (plugin = {
    name: 'saus:routes',
    enforce: 'pre',
    saus: {
      onContext(context) {
        const isBuild = context.config.command == 'build'

        plugin.load = async function (id) {
          if (id == routeMapStubPath) {
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

                  const resolved = await this.resolve(routeModuleId, routesPath)
                  if (!resolved) {
                    return warn(`Failed to resolve route: "${routeModuleId}"`)
                  }

                  resolvedRoutes.push(
                    t.objectProperty(
                      t.stringLiteral(routePath),
                      isBuild
                        ? t.callExpression(t.identifier(routeMarker), [
                            t.stringLiteral(resolved.id),
                          ])
                        : t.stringLiteral(
                            context.basePath +
                              (resolved.id.startsWith(context.root + '/')
                                ? resolved.id.slice(context.root.length + 1)
                                : '@fs/' + resolved.id)
                          )
                    )
                  )
                })
            )

            const transformer: babel.Visitor = {
              ObjectExpression(path) {
                path.node.properties.push(...resolvedRoutes)
              },
            }

            const template = `export default {}`
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
                  const routeChunk = chunks.find(
                    chunk => chunk.modules[routeModuleId]
                  )
                  if (!routeChunk) {
                    throw Error(`Route chunk not found: "${routeModuleId}"`)
                  }
                  return `"${context.basePath + routeChunk.fileName}"`
                }
              )
            }
          }
        }
      },
    },
  })
}
