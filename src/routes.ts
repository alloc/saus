export interface RouteModule extends Record<string, any> {}

export type RouteLoader<T extends object = RouteModule> = () => Promise<T>

export type RouteParams = Record<string, string> & { error?: any }

export type InferRouteParams<T extends string> =
  T extends `${infer Prev}/*/${infer Rest}`
    ? InferRouteParams<Prev> & { wild: string } & InferRouteParams<Rest>
    : T extends `${string}:${infer P}?/${infer Rest}`
    ? { [K in P]?: string } & InferRouteParams<Rest>
    : T extends `${string}:${infer P}/${infer Rest}`
    ? { [K in P]: string } & InferRouteParams<Rest>
    : T extends `${string}:${infer P}?`
    ? { [K in P]?: string }
    : T extends `${string}:${infer P}`
    ? { [K in P]: string }
    : T extends `${string}*`
    ? { wild: string }
    : {}

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

type Promisable<T> = T | PromiseLike<T>

export interface RouteConfig<Params extends object = RouteParams> {
  paths?: () => Promisable<readonly StaticPageParams<Params>[]>
}

export interface ParsedRoute {
  pattern: RegExp
  keys: string[]
}

export interface Route extends RouteConfig, ParsedRoute {
  path: string
  load: RouteLoader
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

/**
 * Coerce a dynamic route path into a normal path.
 *
 *     inlineRouteParams("/users/:name/posts/:postId", ["bob", "123"])
 *     // => "/users/bob/posts/123"
 *
 * Also works with glob star and regex pattern in parentheses.
 *
 *     inlineRouteParams("/users/*", ["bob"])
 *     // => "/users/bob"
 *     inlineRouteParams("/orders/:id(\\d+)", ["123"])
 *     // => "/orders/123"
 */
export function inlineRouteParams(
  path: string,
  params: readonly (string | number)[]
) {
  const splices: [number, number, string | number][] = []
  const regex = /(\*|:\w+)(\([^)]+\))?\??/g
  for (let match: RegExpExecArray, i = 0; (match = regex.exec(path)!); ) {
    splices.push([match.index, regex.lastIndex, params[i++]])
  }
  for (let i = splices.length; --i >= 0; ) {
    const [start, end, param] = splices[i]
    path = path.slice(0, start) + param + path.slice(end)
  }
  return path
}
