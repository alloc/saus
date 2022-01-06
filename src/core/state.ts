import { routesModule } from './global'
import { RegexParam, RouteInclude } from './routes'

export interface StateFragment<T = any, Args extends any[] = any[]> {
  prefix: string
  load(...args: Args): Promise<T>
  bind(...args: Args): StateFragment<T, []>
  get(...args: Args): T
}

/**
 * Include the provided state fragments in all routes by default.
 *
 * The `patterns` argument is an array of route patterns that lets you
 * select which pages will receive the state. These patterns may
 * begin with `!` to negate any matching pages.
 */
export function includeState(
  include: RouteInclude,
  patterns?: (string | RegExp)[]
) {
  if (patterns) {
    const only: RegExp[] = []
    const skip: RegExp[] = []
    for (const pattern of patterns) {
      if (typeof pattern !== 'string') {
        only.push(pattern)
      } else if (pattern[0] !== '!') {
        only.push(RegexParam.parse(pattern).pattern)
      } else {
        skip.push(RegexParam.parse(pattern.slice(1)).pattern)
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

export type ResolvedState<T> = T extends Promise<any>
  ? Resolved<T>
  : T extends ReadonlyArray<infer Element>
  ? Element[] extends T
    ? readonly Resolved<Element>[]
    : { [P in keyof T]: Resolved<T[P]> }
  : T extends object
  ? { [P in keyof T]: Resolved<T[P]> }
  : ResolvedModule<T>

type Resolved<T> = ResolvedModule<T extends Promise<infer U> ? U : T>

type ResolvedModule<T> = T extends { default: infer DefaultExport }
  ? { default: DefaultExport } extends T
    ? DefaultExport
    : T
  : T
