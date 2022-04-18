import { Endpoint } from '../core/endpoint'
import type { BareRoute, RouteIncludeOption } from '../core/routes'
import type { StateModule } from '../runtime/stateModules'

export interface StateModuleMap extends Map<string, Promise<any>> {
  load(module: StateModule): Promise<any>
  include(
    included: RouteIncludeOption,
    url: Endpoint.RequestUrl<any>,
    route: BareRoute
  ): Promise<void>
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
  map.include = async (include, url, route) => {
    const included =
      typeof include == 'function' ? await include(url, route) : include
    await Promise.all(included.map(map.load))
  }
  return map
}
