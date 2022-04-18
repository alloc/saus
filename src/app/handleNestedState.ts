import { isStateModule } from '../runtime/stateModules'
import type { StateModuleMap } from './stateModules'

/**
 * Find state modules in the given object or array. Replace them with an
 * `{@import}` directive for client-side loading, and produce a copy for
 * SSR environments where the state module is inlined.
 */
export function handleNestedState(
  container: any,
  stateModules: StateModuleMap
): any {
  const shallowCopy = Array.isArray(container) ? Array.from : objectSpread

  let ssrContainer: any
  forEach(container, (state, key) => {
    if (isStateModule(state)) {
      ssrContainer ||= shallowCopy(container)
      container[key] = { '@import': state.id }
      stateModules.load(state).then(ssrState => {
        ssrContainer[key] = ssrState
      })
    } else if (isObjectOrArray(state)) {
      const ssrState = handleNestedState(state, stateModules)
      if (ssrState !== state) {
        ssrContainer ||= shallowCopy(container)
        ssrContainer[key] = ssrState
      }
    }
  })

  return ssrContainer || container
}

function isObjectOrArray(value: any): value is Record<string, any> | any[] {
  return value != null && (Array.isArray(value) || value.constructor == Object)
}

function forEach(
  container: Record<string, any> | any[],
  iterator: (value: any, key: string | number) => void
) {
  if (Array.isArray(container)) {
    container.forEach(iterator)
  } else {
    for (const key in container) {
      iterator(container[key], key)
    }
  }
}

function objectSpread(obj: any) {
  return { ...obj }
}
