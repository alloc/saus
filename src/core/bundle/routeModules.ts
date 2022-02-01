import esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import { getResolvedUrl } from '../../utils/getResolvedUrl'
import { SausContext, vite } from '../index'

export type RouteImports = Map<
  esModuleLexer.ImportSpecifier,
  { file: string; url: string }
>

/**
 * Resolve `import(...)` calls for route modules.
 */
export async function resolveRouteImports(
  { root, routesPath }: SausContext,
  pluginContainer: vite.PluginContainer
): Promise<RouteImports> {
  const routeImports: RouteImports = new Map()

  const code = fs.readFileSync(routesPath, 'utf8')
  for (const imp of esModuleLexer.parse(code, routesPath)[0]) {
    if (imp.d >= 0 && imp.n) {
      const resolved = await pluginContainer.resolveId(imp.n, routesPath)
      if (resolved && !resolved.external) {
        routeImports.set(imp, {
          file: resolved.id,
          url: getResolvedUrl(root, resolved.id),
        })
      }
    }
  }

  return routeImports
}
