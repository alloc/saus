import md5Hex from 'md5-hex'
import path from 'path'
import { ClientState, StateModule } from '../client'
import { RuntimeConfig } from '../core/config'
import { debug } from '../core/debug'
import {
  Endpoint,
  isRequestUrl,
  makeRequest,
  makeRequestUrl,
} from '../core/endpoint'
import { setRoutesModule } from '../core/global'
import { applyHtmlProcessors, mergeHtmlProcessors } from '../core/html'
import {
  matchRoute,
  Route,
  RouteEndpointMap,
  RouteIncludeOption,
} from '../core/routes'
import { RuntimeHook } from '../core/setup'
import { HttpRedirect } from '../http'
import { toArray } from '../utils/array'
import { plural } from '../utils/plural'
import {
  emptyArray,
  emptyHeaders,
  headPropsCache,
  stateModulesMap,
} from './global'
import { handleNestedState } from './handleNestedState'
import { createNegotiator } from './negotiator'
import { renderClient } from './renderClient'
import { createRenderPageFn } from './renderPage'
import { createStateModuleMap, loadIncludedState } from './stateModules'
import {
  AppContext,
  ClientFunctions,
  ClientResolver,
  ClientStateLoader,
  ProfiledEventHandler,
  RenderedPage,
  RouteResolver,
} from './types'

export type App = ReturnType<typeof createApp>
export type AppWrapper = (app: App) => Omit<Partial<App>, 'config'>

/**
 * Create a Saus application that can run anywhere. It can render pages
 * and find matching routes/endpoints. Only loaded state modules are cached.
 *
 * Note: This function does not use Vite for anything.
 */
export function createApp(
  context: AppContext,
  generateEndpoint: Endpoint.Generator,
  wrappers: AppWrapper[] = []
) {
  const { config, onError, profile, functions } = context

  // Let runtime hooks inject routes, HTML processors, and page state.
  setRoutesModule(context)
  callRuntimeHooks(context.runtimeHooks, config, onError)
  setRoutesModule(null)

  let {
    defaultState,
    routes,
    catchRoute,
    defaultRoute,
    renderers,
    defaultRenderer,
    beforeRenderHooks,
  } = context

  // Routes and renderers are matched in reverse order.
  routes = [...routes].reverse()
  renderers = [...renderers].reverse()

  const routeCount = routes.length + (defaultRoute ? 1 : 0)
  const rendererCount = renderers.length + (defaultRenderer ? 1 : 0)
  debug(
    'Loaded %s and %s',
    plural(routeCount, 'route'),
    plural(rendererCount, 'renderer')
  )

  // Any HTML processors with `enforce: post` will be applied by the
  // `servePage` function, after any Vite `transformIndexHtml` hooks.
  const htmlProcessors = context.htmlProcessors
  const preProcessHtml =
    htmlProcessors &&
    mergeHtmlProcessors(
      htmlProcessors, //
      page => ({ page, config }),
      ['pre', 'default']
    )

  const loadClientState = createClientStateLoader(
    config,
    defaultState,
    onError,
    profile
  )
  const resolveClient = createClientResolver(functions)
  const renderPage = createRenderPageFn(
    config,
    renderers,
    defaultRenderer,
    beforeRenderHooks,
    loadClientState,
    resolveClient,
    preProcessHtml,
    catchRoute,
    onError,
    profile
  )

  const resolveEndpoints = (
    route: Route,
    method: string,
    negotiate: ContentNegotiater | null
  ): readonly Endpoint[] | undefined => {
    let endpoints: readonly Endpoint[] | undefined
    if (!negotiate) {
      endpoints = route.endpoints?.filter(e => e.method == method)
      return endpoints || emptyArray
    }

    let endpointMap!: RouteEndpointMap
    if (route.methods) {
      endpointMap = route.methods[method]
    } else {
      route.methods = {}
    }

    if (!endpointMap) {
      endpointMap = route.methods[method] = {}

      if (route.moduleId) {
        const endpoints = toArray(generateEndpoint(method, route, app))
        for (const endpoint of endpoints) {
          if (!endpoint) continue
          endpoint.method = method
          for (const type of (endpoint.contentTypes ||= ['text/html'])) {
            endpointMap[type] = endpoint as Endpoint
          }
        }
      }

      if (route.endpoints) {
        for (const endpoint of route.endpoints) {
          if (endpoint.method !== method) continue
          for (const type of endpoint.contentTypes) {
            endpointMap[type] ||= endpoint
          }
        }
      }
    }

    endpoints = negotiate(Object.keys(endpointMap)).map(
      type => endpointMap[type as Endpoint.ContentType]
    )

    if (endpoints.length) {
      return endpoints
    }
  }

  const resolveRoute: RouteResolver = url => {
    const negotiate = createNegotiator(url.headers.accept)

    let route: Route | undefined
    for (route of routes) {
      const params = matchRoute(url.path, route)
      if (params) {
        const endpoints = resolveEndpoints(route, url.method, negotiate)
        if (endpoints) {
          return [endpoints, route, params]
        }
      }
    }
    if ((route = defaultRoute)) {
      const endpoints = resolveEndpoints(route, url.method, negotiate)
      if (endpoints) {
        return [endpoints, route, url.routeParams]
      }
    }
    return [emptyArray]
  }

  const callEndpoints = async (
    url: Endpoint.RequestUrl,
    endpoints = resolveRoute(url)[0]
  ): Promise<Endpoint.ResponseTuple> => {
    let response: Endpoint.ResponseTuple | undefined
    let request = makeRequest(url, (...args) => {
      response = args
    })

    for (const endpoint of endpoints) {
      const returned = await endpoint(request)
      if (response) {
        return response
      }
      if (returned) {
        if (returned instanceof HttpRedirect) {
          return [301, { Location: returned.location }]
        }
        return [returned.status, returned.headers, { buffer: returned.data }]
      }
    }

    return []
  }

  const app = {
    config,
    resolveRoute,
    callEndpoints,
    loadClientState,
    renderPage,
    preProcessHtml,
    postProcessHtml:
      htmlProcessors &&
      ((page: RenderedPage, timeout = config.htmlTimeout) =>
        applyHtmlProcessors(
          page.html,
          htmlProcessors.post,
          { page, config },
          timeout
        )),
  }

  for (const wrap of wrappers) {
    Object.assign(app, wrap(app))
  }

  return app
}

function createClientStateLoader(
  config: RuntimeConfig,
  defaultState: RouteIncludeOption[],
  onError: (e: any) => void,
  profile: ProfiledEventHandler | undefined
): ClientStateLoader {
  return async (url, route) => {
    const requestUrl = !isRequestUrl(url)
      ? makeRequestUrl(url, 'GET', emptyHeaders)
      : url

    const timestamp = Date.now()
    const stateModules = createStateModuleMap()
    const routeConfig = route.config
      ? await route.config(requestUrl, route)
      : route

    // Put the promises returned by route config functions here.
    const deps: Promise<any>[] = []

    // Start loading state modules before the route state is awaited.
    const routeInclude = defaultState.concat([routeConfig.include || []])
    for (const included of routeInclude) {
      deps.push(stateModules.include(included, requestUrl, route, onError))
    }

    const inlinedState = new Set<StateModule>()
    if (routeConfig.inline) {
      const loadInlinedState = (state: StateModule) => {
        return state.load().then(loaded => {
          inlinedState.add(state)
          return loaded
        }, onError)
      }
      deps.push(
        loadIncludedState(
          routeConfig.inline,
          requestUrl,
          route,
          loadInlinedState
        ).catch(onError)
      )
    }

    const routeState = routeConfig.state
    const clientState: ClientState = (
      typeof routeState == 'function'
        ? await routeState(requestUrl, route)
        : { ...routeState }
    ) as any

    clientState.routePath = route.path
    clientState.routeParams = url.routeParams

    // Load any embedded state modules.
    const state = handleNestedState(clientState, stateModules)
    Object.defineProperty(state, '_client', {
      value: clientState,
    })

    // Wait for state modules to load.
    await Promise.all(deps)
    await Promise.all(stateModules.values())
    stateModulesMap.set(state, Array.from(stateModules.keys()))

    profile?.('load state', {
      url: url.toString(),
      timestamp,
      duration: Date.now() - timestamp,
    })

    if (config.command == 'dev')
      Object.defineProperty(state, '_ts', {
        value: Date.now(),
      })

    const { headProps } = routeConfig
    if (headProps) {
      headPropsCache.set(
        state,
        typeof headProps == 'function'
          ? await headProps(requestUrl, state)
          : { ...headProps }
      )
    }

    return state
  }
}

type ContentNegotiater = (provided: string[]) => string[]

function createClientResolver(functions: ClientFunctions): ClientResolver {
  return async ({ client, start }, beforeHooks) => {
    if (client) {
      const result = renderClient(
        client,
        functions.render.find(fn => fn.start === start)!,
        functions.beforeRender.filter(fn =>
          beforeHooks.some(hook => fn.start === hook.start)
        )
      )
      const hash = md5Hex(result.code).slice(0, 8)
      const ext = path.extname(functions.filename)
      return {
        id: `client.${hash}${ext}`,
        ...result,
      }
    }
  }
}

function callRuntimeHooks(
  hooks: RuntimeHook[],
  config: RuntimeConfig,
  onError: (e: any) => void
) {
  for (const setup of hooks) {
    try {
      setup(config)
    } catch (error: any) {
      onError(error)
    }
  }
}
