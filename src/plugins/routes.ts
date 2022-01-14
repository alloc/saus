import fs from 'fs'
import path from 'path'
import { warn } from 'misty'
import { babel, getBabelConfig, t } from '../babel'
import { endent, Plugin, SausConfig } from '../core'

const routesPathStub = path.resolve(__dirname, '../src/client/routes.ts')

type ResolvedId = { id: string }
type LoadResult = { code: string }
type PluginContext = {
  resolve: (id: string, importer?: string) => Promise<ResolvedId | null>
}

/**
 * This plugin extracts the `route` calls from the routes module,
 * so any Node-specific logic is removed for client-side use.
 */
export function routesPlugin({ routes: routesPath }: SausConfig): Plugin {
  let load: (this: PluginContext, id: string) => Promise<LoadResult | undefined>
  return {
    name: 'saus:routes',
    enforce: 'pre',
    load(id) {
      return load && load.call(this, id)
    },
    saus: {
      onContext(context) {
        const isBuild = context.config.command == 'build'

        load = async function (id) {
          if (id == routesPathStub) {
            const routesModule = babel.parseSync(
              fs.readFileSync(routesPath, 'utf8'),
              getBabelConfig(routesPath)
            )!

            const exports: Record<string, Promise<t.ObjectProperty | null>> = {}
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

                  const routeModuleId = (importFn.body as t.CallExpression)
                    .arguments[0] as t.StringLiteral

                  exports[routePath || 'default'] = this.resolve(
                    routeModuleId.value,
                    routesPath
                  ).then(resolved => {
                    if (!resolved) {
                      warn(`Failed to resolve route: "${routeModuleId.value}"`)
                      return null
                    }

                    const resolvedId =
                      (isBuild ? '/' : context.basePath) +
                      (resolved.id.startsWith(context.root + '/')
                        ? resolved.id.slice(context.root.length + 1)
                        : '@fs/' + resolved.id)

                    return t.objectProperty(
                      routePath
                        ? t.stringLiteral(routePath)
                        : t.identifier('default'),
                      t.objectExpression([
                        t.objectProperty(
                          t.identifier('load'),
                          t.arrowFunctionExpression(
                            [],
                            t.callExpression(t.identifier('import'), [
                              t.stringLiteral(resolvedId),
                            ])
                          )
                        ),
                        t.objectProperty(
                          t.identifier('preload'),
                          t.arrowFunctionExpression(
                            [],
                            t.callExpression(t.identifier('preloadModule'), [
                              t.stringLiteral(resolvedId),
                            ])
                          )
                        ),
                      ])
                    )
                  })
                }
              },
            })

            const sausClientUrl = `/@fs/${path.resolve(__dirname, '../client')}`
            const template = endent`
              import { preloadModule } from "${sausClientUrl}"
              export default {}
            `

            const resolvedExports = await Promise.all(Object.values(exports))
            const transformer: babel.Visitor = {
              ObjectExpression(path) {
                // @ts-ignore
                path.node.properties.push(...resolvedExports.filter(Boolean))
                path.skip()
              },
            }

            return babel.transformSync(template, {
              plugins: [{ visitor: transformer }],
            }) as { code: string }
          }
        }
      },
    },
  }
}
