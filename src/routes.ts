import type { ComponentType } from 'react'

export { RouteParams as InferRouteParams } from 'regexparam'

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
  paths?: () => Promisable<readonly StaticPageParams<Params>[]>
  state?: (...params: string[]) => Promisable<InferRouteProps<Module>>
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

export function getPageFilename(url: string) {
  return url == '/' ? 'index.html' : url.slice(1) + '.html'
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
