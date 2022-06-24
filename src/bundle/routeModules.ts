import { toDevPath } from '@/node/toDevPath'
import { vite } from '@/vite'
import esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import { BundleContext } from './context'

export type RouteImports = Map<
  esModuleLexer.ImportSpecifier,
  { file: string; url: string }
>

/**
 * Resolve `import(...)` calls for route modules.
 */
export async function resolveRouteImports(
  { root, routesPath }: BundleContext,
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
          url: toDevPath(resolved.id, root),
        })
      }
    }
  }

  return routeImports
}
