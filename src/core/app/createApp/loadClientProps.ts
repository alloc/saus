import { makeRequest, makeRequestUrl } from '@/makeRequest'
import { StateModule } from '@/runtime/stateModules'
import { prependBase } from '@/utils/base'
import { noop } from '@/utils/noop'
import { CommonClientProps } from '../../types'
import { headPropsCache, inlinedStateMap, stateModulesMap } from '../global'
import { handleNestedState } from '../handleNestedState'
import { createStateModuleMap, loadIncludedState } from '../stateModules'
import { App } from '../types'

export function createClientPropsLoader(
  context: App.Context
): App['loadClientProps'] {
  const { config, profile } = context
  const { debugBase } = config

  return async function loadClientProps(url, route) {
    const requestUrl = makeRequestUrl(url)
    const request = makeRequest(requestUrl, noop)

    const timestamp = Date.now()
    const stateModules = createStateModuleMap()
    const routeConfig = route.config
      ? await route.config(request, route)
      : route

    // Put the promises returned by route config functions here.
    const deps: Promise<any>[] = []

    // Start loading state modules before the route state is awaited.
    const routeInclude = context.defaultState.concat([
      routeConfig.include || [],
    ])
    for (const included of routeInclude) {
      deps.push(stateModules.include(included, request, route))
    }

    let inlinedState: Set<StateModule>
    if (routeConfig.inline) {
      const loadInlinedState = (state: StateModule) => {
        return state.load().then(loaded => {
          inlinedState.add(state)
          return loaded
        })
      }
      inlinedState = new Set()
      deps.push(
        loadIncludedState(routeConfig.inline, request, route, loadInlinedState)
      )
    }

    const clientProps: CommonClientProps = (
      typeof routeConfig.props == 'function'
        ? await routeConfig.props(request, route)
        : { ...routeConfig.props }
    ) as any

    clientProps.routePath =
      route !== context.defaultRoute && debugBase && url.startsWith(debugBase)
        ? prependBase(route.path, debugBase)
        : route.path

    clientProps.routeParams = url.routeParams

    // Load any embedded state modules.
    const props = handleNestedState(clientProps, stateModules)
    Object.defineProperty(props, '_client', {
      value: clientProps,
    })

    // Wait for state modules to load.
    await Promise.all(deps)
    await Promise.all(stateModules.values())

    stateModulesMap.set(props, Array.from(stateModules.keys()))
    inlinedStateMap.set(props, inlinedState!)

    profile?.('load state', {
      url: url.toString(),
      timestamp,
      duration: Date.now() - timestamp,
    })

    if (config.command == 'dev')
      Object.defineProperty(props, '_ts', {
        value: Date.now(),
      })

    const { headProps } = routeConfig
    if (headProps) {
      headPropsCache.set(
        props,
        typeof headProps == 'function'
          ? await headProps(request, props)
          : { ...headProps }
      )
    }

    return props
  }
}
