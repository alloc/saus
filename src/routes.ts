export interface RouteModule extends Record<string, any> {}

export type RouteLoader = () => Promise<RouteModule>

export type RouteParams = Record<string, string> & { error?: any }

export interface RouteConfig {
  load: RouteLoader
  query?: () => string[][] | Promise<string[][]>
}

export interface ParsedRoute {
  pattern: RegExp
  keys: string[]
}

export interface Route extends RouteConfig, ParsedRoute {
  path: string
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
export function inlineRouteParams(path: string, params: string[]) {
  const splices: [number, number, string][] = []
  const regex = /(\*|:\w+)(\?|\([^)]+\))?/g
  for (let match: RegExpExecArray, i = 0; (match = regex.exec(path)!); ) {
    splices.push([match.index, regex.lastIndex, params[i++]])
  }
  for (let i = splices.length; --i >= 0; ) {
    const [start, end, param] = splices[i]
    path = path.slice(0, start) + param + path.slice(end)
  }
  return path
}
