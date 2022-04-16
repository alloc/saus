import { parseDynamicImport } from '../utils/parseDynamicImport'
import { getStackFrame } from '../utils/resolveStackTrace'
import { routesModule } from './global'
import {
  GeneratedRouteConfig,
  InferRouteParams,
  RegexParam,
  RouteConfig,
} from './routes'

/** Define a route */
export function generateRoute<RoutePath extends string, Module extends object>(
  path: RoutePath,
  {
    entry,
    ...config
  }: GeneratedRouteConfig<Module, InferRouteParams<RoutePath>>
): void {
  const importer = config.importer ?? getStackFrame(2)?.file
  const ssrRequire = routesModule.ssrRequire!

  let moduleId: string
  let load: () => Promise<any>
  if (typeof entry == 'string') {
    moduleId = entry
    load = () => ssrRequire(entry, importer, true)
  } else {
    moduleId = parseDynamicImport(entry, path)
    load = entry
  }

  routesModule.routes.push({
    ...(config as RouteConfig),
    ...RegexParam.parse(path),
    path,
    load,
    moduleId,
    generated: true,
    importer,
  })
}
