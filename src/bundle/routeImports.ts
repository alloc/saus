import { servedPathForFile } from '@/node/servedPathForFile'
import * as esModuleLexer from 'es-module-lexer'
import { BundleContext } from './context'

export type RouteImports = Map<
  esModuleLexer.ImportSpecifier,
  { file: string; url: string }
>

/**
 * Resolve `import(...)` calls for route modules.
 */
export async function resolveRouteImports({
  root,
  routesPath,
  resolveId,
  load,
}: BundleContext): Promise<RouteImports> {
  const routeImports: RouteImports = new Map()

  const loadResult = await load(routesPath)
  if (!loadResult) {
    return routeImports
  }

  const code = loadResult.code
  for (const imp of esModuleLexer.parse(code, routesPath)[0]) {
    if (imp.d >= 0 && imp.n) {
      const resolved = await resolveId(imp.n, routesPath)
      if (resolved && !resolved.external) {
        routeImports.set(imp, {
          file: resolved.id,
          url: servedPathForFile(resolved.id, root),
        })
      }
    }
  }

  return routeImports
}
