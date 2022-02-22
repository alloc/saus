import type { StateModule } from '../runtime/stateModules'
import type { RouteInclude, RouteParams } from '../core/routes'
import type { ParsedUrl } from '../utils/url'

export interface StateModuleMap extends Map<string, Promise<any>> {
  load(module: StateModule): Promise<any>
  include(
    included: RouteInclude,
    url: ParsedUrl,
    params: RouteParams
  ): Promise<any>[]
}

export function createStateModuleMap() {
  const map = new Map() as StateModuleMap
  map.load = state => {
    let loading = map.get(state.id)
    if (!loading) {
      loading = state.load()
      map.set(state.id, loading)
    }
    return loading.catch(() => null)
  }
  map.include = (include, url, params) => {
    const included =
      typeof include == 'function' ? include(url, params) : include
    return included.map(map.load)
  }
  return map
}
