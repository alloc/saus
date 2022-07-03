import { routesModule } from '@/global'
import { RouteIncludeOption } from '@/routes'
import { parseRoutePath } from '@/utils/parseRoutePath'

/**
 * Include the provided state modules in all routes by default.
 *
 * The `patterns` argument is an array of route patterns that lets you
 * select which pages will receive the state. These patterns may
 * begin with `!` to negate any matching pages.
 */
export function includeState(
  include: RouteIncludeOption,
  patterns?: (string | RegExp)[]
) {
  if (patterns) {
    const only: RegExp[] = []
    const skip: RegExp[] = []
    for (const pattern of patterns) {
      if (typeof pattern !== 'string') {
        only.push(pattern)
      } else if (pattern[0] !== '!') {
        only.push(parseRoutePath(pattern).pattern)
      } else {
        skip.push(parseRoutePath(pattern.slice(1)).pattern)
      }
    }
    const match = (path: string) => {
      if (only.length && !only.some(re => re.test(path))) {
        return false
      }
      if (skip.length && skip.some(re => re.test(path))) {
        return false
      }
      return true
    }
    routesModule.defaultState.push(
      typeof include == 'function'
        ? (url, params) => (match(url.path) ? include(url, params) : [])
        : (url, params) => (match(url.path) ? include : [])
    )
  } else {
    routesModule.defaultState.push(include)
  }
}
