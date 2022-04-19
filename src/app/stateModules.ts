import { Endpoint } from '../core/endpoint'
import type { BareRoute, RouteIncludeOption } from '../core/routes'
import type { StateModule } from '../runtime/stateModules'

export interface StateModuleMap extends Map<string, Promise<any>> {
  load(module: StateModule): Promise<any>
  include(
    included: RouteIncludeOption,
    url: Endpoint.RequestUrl<any>,
    route: BareRoute,
    onError: (e: any) => void
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

  map.include = (include, url, route, onError) =>
    loadIncludedState(include, url, route, state =>
      map.load(state).catch(onError)
    ).catch(onError)

  return map
}

export async function loadIncludedState(
  include: RouteIncludeOption,
  url: Endpoint.RequestUrl<any>,
  route: BareRoute,
  load = (state: StateModule) => state.load()
) {
  if (typeof include == 'function') {
    include = await include(url, route)
  }
  const loading: Promise<any>[] = []
  for (const value of include) {
    if (Array.isArray(value)) {
      loading.push(...value.map(load))
    } else {
      loading.push(load(value as StateModule))
    }
  }
  await Promise.all(loading)
}
