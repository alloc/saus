import { generateId } from '@/utils/generateId'
import endent from 'endent'
import { SausContext } from './context'
import { VirtualModule } from './plugins/moduleProvider'

export interface VirtualRoute {
  /** Route pattern used for matching HTTP requests */
  path: string
  /**
   * The route module (as a module ID or virtual module) that exports
   * whatever is needed to render this route to HTML (or possibly
   * another format).
   */
  entry?: string | VirtualModule
  /** Path to route layout module (must use default export) */
  layout?: string | VirtualModule
  /** Path to route plugin module (must use default export) */
  plugin?: string
}

export function renderVirtualRoutes(routes: VirtualRoute[]) {
  const pluginIdents: Record<string, string> = {}
  let nextPluginId = 1

  return endent`
    import { route } from 'saus' 
    ${routes
      .map(route => {
        let lines: string[] = []
        let pluginIdent = 'undefined'
        if (route.plugin) {
          pluginIdent = pluginIdents[route.plugin]
          if (!pluginIdent) {
            pluginIdent = pluginIdents[
              route.plugin
            ] = `_plugin${nextPluginId++}`
            lines.push(`import ${pluginIdent} from '${route.plugin}'`)
          }
        }
        const routeConfig = [
          route.entry && `entry: () => import('${route.entry}')`,
          route.layout && `layout: () => import('${route.layout}')`,
          route.plugin && `plugin: ${pluginIdent}`,
        ]
        const routeCall = endent`
          route('${route.path}', {
            ${routeConfig.filter(Boolean).join(',\n')}
          })
        `
        lines.push(routeCall)
        return lines.join('\n')
      })
      .join('\n')}
  `
}

/**
 * In cases where `saus.routes` points to a virtual module, this function
 * can be used to easily generate that virtual module.
 *
 * Any virtual modules passed via the `routes` argument are injected
 * into the server context automatically.
 */
export function injectRoutesModule(ctx: SausContext, routes: VirtualRoute[]) {
  for (const route of routes) {
    if (route.entry && typeof route.entry !== 'string') {
      route.entry = ctx.injectedModules.addServerModule(route.entry).id
    }
    if (route.layout && typeof route.layout !== 'string') {
      route.layout = ctx.injectedModules.addServerModule(route.layout).id
    }
  }
  ctx.injectedModules.addServerModule({
    id: ctx.routesPath,
    code: renderVirtualRoutes(routes),
  })
}

/**
 * Inject virtual routes that are matched against *after* any
 * user-defined routes.
 */
export function injectRoutes(
  ctx: Pick<SausContext, 'injectedImports' | 'injectedModules'>,
  routes: VirtualRoute[]
) {
  ctx.injectedImports.prepend.push(
    ctx.injectedModules.addServerModule({
      id: `\0virtual-routes-${generateId()}.js`,
      code: renderVirtualRoutes(routes),
    }).id
  )
}
