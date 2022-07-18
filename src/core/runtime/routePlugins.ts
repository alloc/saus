import { Promisable } from 'type-fest'
import { Route, RouteConfig, RouteModule } from '../routes'

export type RoutePlugin<
  Module extends object = any,
  Params extends object = any
> = (
  config: RouteConfig<Module, Params>
) => RoutePlugin.PostHook<Module, Params> | void

export namespace RoutePlugin {
  export type PostHook<
    Module extends object = any,
    Params extends object = any
  > = (
    router: Route.API<Params>,
    route: Route<Module, Params>
  ) => Promisable<void>
}

export function defineRoutePlugin<
  Module extends object = RouteModule,
  Params extends object = {}
>(plugin: RoutePlugin<Module, Params>) {
  return plugin
}
