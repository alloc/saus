import type { ComponentType } from 'react'
import type { RouteParams as InferRouteParams } from 'regexparam'
import * as RegexParam from 'regexparam'
import { ParsedUrl, URLSearchParams } from '../utils/url'
import { SausContext } from './context'
import { HtmlContext } from './html'
import { RuntimeHook } from './setup'
import { StateFragment } from './state'

export { RegexParam, InferRouteParams }

export interface RouteModule extends Record<string, any> {}

export type RouteLoader<T extends object = RouteModule> = () => Promise<T>

export type RouteParams = Record<string, string>

type HasOneKey<T> = [string & keyof T] extends infer Keys
  ? Keys extends [infer Key]
    ? Key extends any
      ? [string & keyof T] extends [Key]
        ? 1
        : 0
      : never
    : never
  : never

type StaticPageParams<Params extends object> = 1 extends HasOneKey<Params>
  ? string | number
  : readonly (string | number)[]

type InferRouteProps<T extends object> = T extends ComponentType<infer Props>
  ? Props
  : Record<string, any>

type Promisable<T> = T | PromiseLike<T>

export interface RouteConfig<
  Module extends object = RouteModule,
  Params extends object = RouteParams
> {
  /**
   * Define which pages should be statically generated by providing
   * their path params.
   */
  paths?: () => Promisable<readonly StaticPageParams<Params>[]>
  /**
   * Load the page state for this route. This state exists during hydration
   * and is usually provided to the root component on the page.
   */
  state?: (
    pathParams: string[],
    searchParams: URLSearchParams
  ) => Promisable<InferRouteProps<Module>>
  /**
   * Declare which state fragments are required by this route.
   *
   * For state fragments whose `load` method expects one or more arguments,
   * you should define those arguments with the `bind` method. If no arguments
   * are expected, pass the state fragment without calling any method.
   */
  include?:
    | StateFragment<any, []>[]
    | ((url: ParsedUrl, params: RouteParams) => StateFragment<any, []>[])
}

export interface ParsedRoute {
  pattern: RegExp
  keys: string[]
}

export interface Route extends RouteConfig, ParsedRoute {
  path: string
  load: RouteLoader
  moduleId: string
}

export function matchRoute(path: string, route: ParsedRoute) {
  return route.pattern
    .exec(path)
    ?.slice(1)
    .reduce((params: Record<string, string>, value, i) => {
      params[route.keys[i]] = value
      return params
    }, {})
}

/**
 * Values configurable from the `saus.routes` module defined
 * in your Vite config.
 */
export interface RoutesModule extends HtmlContext {
  /** These hooks are called after the routes module is loaded */
  runtimeHooks: RuntimeHook[]
  /** Routes defined with the `route` function */
  routes: Route[]
  /** The route used when no route is matched */
  defaultRoute?: Route
}

type RoutePathHandlers = {
  path: (path: string, params?: RouteParams) => void
  error: (error: { reason: string; path: string }) => void
}

/**
 * Using `context.routes` and `context.defaultRoute`, every known path is passed
 * to the `path` handler. The default route generates the `default` path. Routes
 * with dynamic params will be called once per element in their `paths` array,
 * and you still need to call `RegexParam.inject` to get the real path.
 */
export async function generateRoutePaths(
  context: SausContext,
  handlers: RoutePathHandlers
) {
  const { path: onPath, error: onError } = handlers

  for (const route of context.routes) {
    if (route.paths) {
      if (!route.keys.length) {
        onError({
          path: route.path,
          reason: `Route with "paths" needs a route parameter`,
        })
      } else {
        for (const result of await route.paths()) {
          const values = Array.isArray(result)
            ? (result as (string | number)[])
            : [result]

          const params: RouteParams = {}
          route.keys.forEach((key, i) => {
            params[key] = '' + values[i]
          })

          onPath(route.path, params)
        }
      }
    } else if (!route.keys.length) {
      onPath(route.path)
    }
  }

  if (context.defaultRoute) {
    onPath(context.defaultPath)
  }
}
