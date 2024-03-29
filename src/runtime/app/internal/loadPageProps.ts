import { mergeArrays, toArray } from '@utils/array'
import { ascendBranch } from '@utils/ascendBranch'
import { prependBase } from '@utils/base'
import { noop } from '@utils/noop'
import createDebug from 'debug'
import { globalCache } from '../../cache/global'
import { CommonClientProps } from '../../clientTypes'
import { Endpoint } from '../../endpoint'
import { makeRequest, makeRequestUrl } from '../../makeRequest'
import { BareRoute, RouteIncludeOption } from '../../routeTypes'
import { StateModule } from '../../stateModules'
import { hydrateState } from '../../stateModules/hydrate'
import { serveState } from '../../stateModules/serve'
import {
  App,
  CommonServerProps,
  LoadedStateModule,
  PagePropsLoader,
} from '../types'

const debug = createDebug('saus:pages')

export function createPagePropsLoader(context: App.Context): PagePropsLoader {
  const { config, profile } = context
  const { debugBase } = config

  return async function loadPageProps(url, route) {
    debug('Loading page props: %s', url)
    const requestUrl = makeRequestUrl(url)
    const request = makeRequest(requestUrl, noop)

    const timestamp = Date.now()
    const routeConfig = route.config
      ? await route.config(request, route)
      : route

    const inlinedModules = new Set<StateModule<any, []>>()
    const loadedModules = new Map<string, Promise<LoadedStateModule>>()

    const loadStateModule = (
      module: StateModule<any, []>,
      isInlined?: boolean
    ) => {
      const { key } = module
      if (isInlined) {
        inlinedModules.add(module)
      }
      let promise = loadedModules.get(key)
      if (!promise) {
        let wasCached = true
        promise = serveState(module, {
          // Inlined modules shouldn't be externally cached.
          bypassPlugin: isInlined,
          onLoad() {
            wasCached = false
          },
        }).then((served): LoadedStateModule => {
          if (!globalCache.loaded[key]) {
            // Expose the hydrated state to SSR components.
            const hydratedState = hydrateState(key, served, module, {
              deepCopy: true,
            })
            globalCache.loaded[key] = {
              ...served,
              state: hydratedState,
            }
          }
          return {
            ...served,
            stateModule: module,
            wasCached,
            get inlined() {
              return inlinedModules.has(module)
            },
          }
        })
        loadedModules.set(key, promise)
      }
      return promise.catch(noop)
    }

    // Start loading state modules before the route state is awaited.
    const routeInclude = mergeArrays(
      ...ascendBranch(route, 'parent', route => route.defaultState),
      [routeConfig.include],
      context.defaultState
    )
    for (const included of routeInclude) {
      if (included) {
        await loadIncludedState(included, request, route, loadStateModule)
      }
    }

    if (routeConfig.inline) {
      await loadIncludedState(routeConfig.inline, request, route, module =>
        loadStateModule(module, true)
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

    const props: CommonServerProps = await loadServerProps(
      clientProps,
      loadStateModule
    )

    type InternalProps = Omit<CommonServerProps, keyof CommonClientProps>
    const internalProps: InternalProps = {
      _ts: timestamp,
      _maxAge: routeConfig.maxAge,
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
      if (inlinedModules.has(loaded.stateModule)) {
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
  for (const value of include) {
    toArray(value).forEach(load)
  }
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
    if (state instanceof StateModule) {
      ssrContainer ||= shallowCopy(container)
      container[key] = { '@import': state.key }
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
