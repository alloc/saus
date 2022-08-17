import { Endpoint } from '@/endpoint'
import { makeRequest, makeRequestUrl } from '@/makeRequest'
import { BareRoute, RouteIncludeOption } from '@/routes'
import { isStateModule, StateModule } from '@/runtime/stateModules'
import { loadStateModule } from '@/runtime/stateModules/loader'
import { CommonClientProps } from '@/types'
import { mergeArrays } from '@/utils/array'
import { ascendBranch } from '@/utils/ascendBranch'
import { prependBase } from '@/utils/base'
import { noop } from '@/utils/noop'
import {
  App,
  CommonServerProps,
  LoadedStateModule,
  PagePropsLoader,
} from '../types'

export function createPagePropsLoader(context: App.Context): PagePropsLoader {
  const { config, profile } = context
  const { debugBase } = config

  return async function loadPageProps(url, route) {
    const requestUrl = makeRequestUrl(url)
    const request = makeRequest(requestUrl, noop)

    const timestamp = Date.now()
    const routeConfig = route.config
      ? await route.config(request, route)
      : route

    const inlinedModules = new Set<StateModule<any, []>>()
    const inlineState = (module: StateModule<any, []>) => {
      inlinedModules.add(module)
      return addStateModule(module)
    }

    const loadedModules = new Map<string, Promise<LoadedStateModule>>()
    const addStateModule = (module: StateModule<any, []>) => {
      let promise = loadedModules.get(module.id)
      if (!promise)
        loadedModules.set(
          module.id,
          (promise = loadStateModule(module).then(([state, expiresAt]) => {
            return {
              module,
              state,
              expiresAt,
              get inlined() {
                return inlinedModules.has(module)
              },
            }
          }))
        )
      return promise
    }

    // Start loading state modules before the route state is awaited.
    const routeInclude = mergeArrays(
      ...ascendBranch(route, 'parent', route => route.defaultState),
      [routeConfig.include],
      context.defaultState
    )
    for (const included of routeInclude) {
      if (included) {
        loadIncludedState(included, request, route, addStateModule)
      }
    }

    if (routeConfig.inline) {
      loadIncludedState(routeConfig.inline, request, route, inlineState)
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

    const props: CommonServerProps = await loadServerProps(
      clientProps,
      addStateModule
    )

    type InternalProps = Omit<CommonServerProps, keyof CommonClientProps>
    const internalProps: InternalProps = {
      _ts: undefined,
      _inlined: [],
      _included: [],
      _headProps: undefined,
      _clientProps: clientProps,
    }

    for (const [key, value] of Object.entries(internalProps)) {
      Object.defineProperty(props, key, { value, writable: true })
    }

    // Wait for state modules to load.
    for (const loaded of await Promise.all(loadedModules.values())) {
      if (inlinedModules.has(loaded.module)) {
        props._inlined.push(loaded)
      } else {
        props._included.push(loaded)
      }
    }

    const { headProps } = routeConfig
    if (headProps) {
      props._headProps =
        typeof headProps == 'function'
          ? await headProps(request, props)
          : { ...headProps }
    }

    if (config.command == 'dev') {
      props._ts = Date.now()
    }

    profile?.('load state', {
      url: url.toString(),
      timestamp,
      duration: Date.now() - timestamp,
    })

    return props
  }
}

async function loadIncludedState(
  include: RouteIncludeOption,
  request: Endpoint.Request<any>,
  route: BareRoute,
  load: (state: StateModule<any, []>) => any
) {
  if (typeof include == 'function') {
    include = await include(request, route)
  }
  const loading: Promise<any>[] = []
  for (const value of include) {
    if (Array.isArray(value)) {
      loading.push(...value.map(load))
    } else {
      loading.push(load(value as any))
    }
  }
  await Promise.all(loading)
}

/**
 * Find state modules in the given object or array. Replace them with an
 * `{@import}` directive for client-side loading, and produce a copy for
 * SSR environments where the state module is inlined.
 */
async function loadServerProps(
  container: any,
  load: (stateModule: StateModule<any, []>) => Promise<any>
): Promise<any> {
  const shallowCopy = Array.isArray(container) ? Array.from : objectSpread
  const promises: Promise<any>[] = []

  let ssrContainer: any
  forEach(container, (state, key) => {
    if (isStateModule(state)) {
      ssrContainer ||= shallowCopy(container)
      container[key] = { '@import': state.id }
      promises.push(
        load(state as any).then(ssrState => {
          ssrContainer[key] = ssrState
        })
      )
    } else if (isObjectOrArray(state)) {
      promises.push(
        loadServerProps(state, load).then(ssrState => {
          if (ssrState !== state) {
            ssrContainer ||= shallowCopy(container)
            ssrContainer[key] = ssrState
          }
        })
      )
    }
  })

  await Promise.all(promises)
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
