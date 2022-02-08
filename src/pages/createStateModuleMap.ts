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

type OnError = (error: any) => void

export function createStateModuleMap(onError: OnError) {
  const map = new Map() as StateModuleMap
  map.load = loadStateModule.bind(null, map, onError)
  map.include = includeStateModules.bind(null, map, onError)
  return map
}

function loadStateModule(
  loaded: Map<string, Promise<any>>,
  onError: OnError,
  state: StateModule
) {
  let loading = loaded.get(state.id)
  if (!loading) {
    loading = state.load().catch(error => {
      onError(error)
      return null
    })
    loaded.set(state.id, loading)
  }
  return loading
}

function includeStateModules(
  loaded: Map<string, Promise<any>>,
  onError: OnError,
  include: RouteInclude,
  url: ParsedUrl,
  params: RouteParams
) {
  const included = typeof include == 'function' ? include(url, params) : include
  return included.map(loadStateModule.bind(null, loaded, onError))
}
