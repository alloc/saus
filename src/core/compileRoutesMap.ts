import { babel, t } from '@utils/babel'
import { prependBase } from '@utils/base'
import endent from 'endent'
import path from 'path'
import { SausContext } from './context'

const clientDir = path.resolve(__dirname, '../client')

export const routeMarker = '__sausRoute'

export async function compileRoutesMap(
  options: { ssr?: boolean; isBuild?: boolean; isClient?: boolean },
  context: SausContext
) {
  const routes = context.routes.map(
    route => [context.basePath + route.path.slice(1), route] as const
  )
  context.defaultRoute && routes.push(['default', context.defaultRoute])
  context.catchRoute && routes.push(['error', context.catchRoute])

  const routeMappings: t.ObjectProperty[] = []
  for (const [key, route] of routes.reverse()) {
    const routeClient = context.routeClients.getClientByRoute(route)
    if (routeClient) {
      let propertyValue: t.Expression
      if (options.isBuild) {
        // For the client-side route map, the resolved module path
        // must be mapped to the production chunk created by Rollup.
        // To do this, we use a placeholder `__sausRoute` call which
        // is replaced in the `generateBundle` plugin hook.
        if (options.isClient) {
          propertyValue = t.callExpression(t.identifier(routeMarker), [
            t.stringLiteral(routeClient.id),
          ])
          if (!options.ssr) {
            propertyValue = t.binaryExpression(
              '+',
              t.identifier('BASE_URL'),
              propertyValue
            )
          }
        }
        // For the server-side route map, the route is mapped to
        // a SSR module ID that's associated with a module wrapper
        // using the `__d` function.
        else {
          propertyValue = t.stringLiteral(routeClient.id.replace('client/', ''))
        }
      } else {
        // In dev mode, the route mapping points to a dev URL.
        propertyValue = t.stringLiteral(
          prependBase(routeClient.url, context.basePath)
        )
      }

      routeMappings.push(t.objectProperty(t.stringLiteral(key), propertyValue))
    }
  }

  const transformer: babel.Visitor = {
    ObjectExpression(path) {
      routeMappings.forEach(prop => path.node.properties.push(prop))
    },
  }

  // NOTE: If you change the name, make sure to also update the regex in
  // the `useDebugRoutes` function used by the client bundle compiler.
  const name = options.isClient
    ? 'clientEntriesByRoute'
    : 'serverEntriesByRoute'

  let template = endent`
    const ${name} = {}
    export default ${name}
  `

  if (options.isClient && !options.ssr) {
    template = `import { BASE_URL } from "${clientDir}"\n` + template
  }

  const result = babel.transformSync(template, {
    plugins: [{ visitor: transformer }],
  }) as { code: string }

  return result
}
