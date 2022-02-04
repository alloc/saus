import fs from 'fs'
import path from 'path'
import { warn } from 'misty'
import { babel, getBabelConfig, t } from '../babel'
import { SausContext } from './context'
import { bundleDir } from './paths'

const coreRuntimePath = path.join(bundleDir, 'core.ts')

export const routeMarker = '__sausRoute'

type ResolvedId = { id: string }

export async function compileRoutesMap(
  options: { isBuild?: boolean; isClient?: boolean },
  context: SausContext,
  resolveId: (id: string, importer: string) => Promise<ResolvedId | null>,
  clientRouteMap?: Record<string, string>
) {
  const routesModulePath = context.routesPath
  const routesModule = babel.parseSync(
    fs.readFileSync(routesModulePath, 'utf8'),
    getBabelConfig(routesModulePath)
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
          (importFn.body as t.CallExpression).arguments[0] as t.StringLiteral
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
    unresolvedRoutes.reverse().map(async ([routePath, routeModuleId]) => {
      // Protect against duplicate route paths.
      if (routePaths.has(routePath)) return
      routePaths.add(routePath)

      let resolvedId = clientRouteMap && clientRouteMap[routeModuleId]
      if (!resolvedId) {
        const resolved = await resolveId(routeModuleId, routesModulePath)
        if (!resolved) {
          return warn(`Failed to resolve route: "${routeModuleId}"`)
        }
        resolvedId = resolved.id
        if (clientRouteMap) {
          clientRouteMap[routeModuleId] = resolvedId
        }
      }

      let propertyValue: t.Expression
      if (options.isBuild) {
        // For the client-side route map, the resolved module path
        // must be mapped to the production chunk created by Rollup.
        // To do this, we use a placeholder `__sausRoute` call which
        // is replaced in the `generateBundle` plugin hook.
        if (options.isClient) {
          propertyValue = t.callExpression(t.identifier(routeMarker), [
            t.stringLiteral(resolvedId),
          ])
        }
        // For the server-side route map, the route is mapped to
        // a dev URL, since the SSR module system uses that.
        else {
          propertyValue = t.stringLiteral(
            '/' + path.relative(context.root, resolvedId)
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
  if (!options.isClient) {
    template =
      `import { ssrRequire } from "/@fs/${coreRuntimePath}"\n` + template
  }

  const result = babel.transformSync(template, {
    plugins: [{ visitor: transformer }],
  }) as { code: string }

  return result
}
