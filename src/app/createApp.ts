import { klona } from 'klona'
import path from 'path'
import { CommonClientProps, StateModule } from '../client'
import { RuntimeConfig } from '../core/config'
import { debug } from '../core/debug'
import { Endpoint } from '../core/endpoint'
import { getModuleRenderer } from '../core/getModuleRenderer'
import { setRoutesModule } from '../core/global'
import { applyHtmlProcessors, mergeHtmlProcessors } from '../core/html'
import { makeRequest, makeRequestUrl } from '../core/makeRequest'
import {
  matchRoute,
  Route,
  RouteEndpointMap,
  RouteIncludeOption,
} from '../core/routes'
import { RuntimeHook } from '../core/setup'
import { DeclaredHeaders, ResponseHeaders } from '../http/headers'
import { HttpRedirect } from '../http/redirect'
import { toArray } from '../utils/array'
import { baseToRegex, prependBase } from '../utils/base'
import { md5Hex } from '../utils/md5-hex'
import { noop } from '../utils/noop'
import { pick, pickAllExcept } from '../utils/pick'
import { plural } from '../utils/plural'
import { defineBuiltinRoutes } from './builtinRoutes'
import {
  emptyArray,
  headPropsCache,
  inlinedStateMap,
  stateModulesMap,
} from './global'
import { handleNestedState } from './handleNestedState'
import { createNegotiator } from './negotiator'
import { renderClient } from './renderClient'
import { createRenderPageFn } from './renderPage'
import { createStateModuleMap, loadIncludedState } from './stateModules'
import {
  App,
  AppContext,
  ClientFunctions,
  ClientPropsLoader,
  ClientResolver,
  ProfiledEventHandler,
  RouteResolver,
} from './types'

/**
 * Create a Saus application that can run anywhere. It can render pages
 * and find matching routes/endpoints. Only loaded state modules are cached.
 *
 * Note: This function does not use Vite for anything.
 */
export function createApp(
  context: AppContext,
  plugins: App.Plugin[] = []
): App {
  const { config, onError, profile, functions } = context
  const moduleRenderer = getModuleRenderer(context)

  // Use an isolated context for each `createApp` instance, since
  // runtime hooks can define anything the routes module can.
  context = cloneRouteContext(context)

  setRoutesModule(context)
  callRuntimeHooks(context.runtimeHooks, plugins, config, onError)
  defineBuiltinRoutes(context, moduleRenderer)
  setRoutesModule(null)

  let {
    defaultState,
    routes,
    catchRoute,
    defaultRoute,
    renderers,
    defaultRenderer,
    beforeRenderHooks,
    requestHooks,
    responseHooks,
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

  const loadClientProps = createClientPropsLoader(
    config,
    defaultState,
    defaultRoute,
    profile
  )

  const resolveClient = createClientResolver(functions)
  const renderPage = createRenderPageFn(
    config,
    renderers,
    defaultRenderer,
    beforeRenderHooks,
    (url, route) => app.loadClientProps(url, route),
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
    let endpointMap!: RouteEndpointMap
    if (route.methods) {
      endpointMap = route.methods[method]
    } else {
      route.methods = {}
    }

    if (!endpointMap) {
      endpointMap = route.methods[method] = {}

      if (route.moduleId && app.getEndpoints) {
        route.endpoints ||= []
        const endpoints = toArray(app.getEndpoints(method, route))
        for (const endpoint of endpoints) {
          if (!endpoint) continue
          endpoint.method = method
          for (const type of (endpoint.contentTypes ||= ['*/*'])) {
            endpointMap[type] = [endpoint as Endpoint]
          }
          route.endpoints.push(endpoint as Endpoint)
        }
      }

      if (route.endpoints) {
        for (const endpoint of route.endpoints) {
          if (endpoint.method !== method) continue
          for (const type of endpoint.contentTypes) {
            const endpointsForType = endpointMap[type]
            if (endpointsForType) {
              endpointsForType.push(endpoint)
            } else {
              endpointMap[type] = [endpoint]
            }
          }
        }
      }
    }

    let endpoints: Endpoint[] | undefined

    if (!negotiate) {
      endpoints = route.endpoints?.filter(e => e.method == method)
      return endpoints || emptyArray
    }

    endpoints = negotiate(Object.keys(endpointMap))
      .concat('*/*')
      .map(type => endpointMap[type as Endpoint.ContentType] || emptyArray)
      .flat()

    if (endpoints.length) {
      return endpoints
    }
  }

  const debugBase = config.debugBase || ''
  const debugBaseRE = debugBase ? baseToRegex(debugBase) : null

  const resolveRoute: RouteResolver = url => {
    const negotiate = createNegotiator(url.headers.accept)
    const routedPath = debugBaseRE
      ? url.path.replace(debugBaseRE, '/')
      : url.path

    let route: Route | undefined
    for (route of routes) {
      const params = matchRoute(routedPath, route)
      if (params) {
        const endpoints = resolveEndpoints(route, url.method, negotiate)
        if (endpoints) {
          url.routeParams = params
          return [endpoints, route]
        }
      }
    }
    if ((route = defaultRoute)) {
      const endpoints = resolveEndpoints(route, url.method, negotiate)
      if (endpoints) {
        return [endpoints, route]
      }
    }
    return [emptyArray]
  }

  const callEndpoints: App['callEndpoints'] = async (
    url,
    endpoints = resolveRoute(url)[0]
  ) => {
    let promise: Endpoint.ResponsePromise | undefined
    let response: Endpoint.Response | undefined
    let headers = new DeclaredHeaders(null as ResponseHeaders | null)
    let request = makeRequest(
      url,
      function respondWith(arg1, body?: Endpoint.ResponseTuple[1]) {
        if (response) return
        if (arg1 instanceof Promise) {
          promise = arg1
        } else {
          response = createResponse(headers, arg1, body)
        }
      }
    )

    if (requestHooks) {
      endpoints = requestHooks.concat(endpoints)
    }

    for (const endpoint of endpoints) {
      const returned = await endpoint(request, headers, app)
      if (response) {
        break
      }
      if (promise) {
        const resolved = await promise
        promise = undefined
        if (resolved) {
          const [arg1, body] = resolved
          response = createResponse(headers, arg1, body)
          break
        }
      }
      if (returned) {
        if (returned instanceof HttpRedirect) {
          headers.location(returned.location)
          response = createResponse(headers, 301)
        } else {
          headers.merge(returned.headers)
          response = createResponse(headers, returned.status, {
            buffer: returned.data,
          })
        }
        break
      }
    }

    if (responseHooks && response?.status)
      for (const onResponse of responseHooks) {
        await onResponse(request, response, app)
      }

    return response || {}
  }

  const app = {
    config,
    resolveRoute,
    getEndpoints: null,
    callEndpoints,
    loadClientProps,
    renderPage,
    ...moduleRenderer,
    preProcessHtml,
    postProcessHtml:
      htmlProcessors &&
      ((page, timeout = config.htmlTimeout) =>
        applyHtmlProcessors(
          page.html,
          htmlProcessors.post,
          { page, config },
          timeout
        )),
  } as App

  for (const plugin of plugins) {
    Object.assign(app, plugin(app))
  }

  return app
}

function createResponse(
  headers: DeclaredHeaders,
  arg1: number | Endpoint.ResponseTuple | Endpoint.ResponseStream | undefined,
  body?: Endpoint.ResponseTuple[1]
): Endpoint.Response {
  let status: number
  if (Array.isArray(arg1)) {
    body = arg1[1]
    arg1 = arg1[0]
  }
  if (!arg1 || typeof arg1 == 'number') {
    status = arg1!
    if (body) {
      headers.merge(body.headers)
      body = pickAllExcept(body, ['headers'])
    }
  } else {
    status = arg1.statusCode!
    headers.merge(arg1.headers)
    body = { stream: arg1 }
  }
  return {
    ok: status >= 200 && status < 400,
    status,
    headers,
    body,
  }
}

function createClientPropsLoader(
  config: RuntimeConfig,
  defaultState: RouteIncludeOption[],
  defaultRoute: Route | undefined,
  profile: ProfiledEventHandler | undefined
): ClientPropsLoader {
  const { debugBase } = config

  return async (url, route) => {
    const requestUrl = makeRequestUrl(url, 'GET')
    const request = makeRequest(requestUrl, noop)

    const timestamp = Date.now()
    const stateModules = createStateModuleMap()
    const routeConfig = route.config
      ? await route.config(request, route)
      : route

    // Put the promises returned by route config functions here.
    const deps: Promise<any>[] = []

    // Start loading state modules before the route state is awaited.
    const routeInclude = defaultState.concat([routeConfig.include || []])
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
      route !== defaultRoute && debugBase && url.startsWith(debugBase)
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

function cloneRouteContext(context: AppContext): AppContext {
  return {
    ...context,
    ...klona(
      pick(context, [
        'routes',
        'defaultState',
        'htmlProcessors',
        'requestHooks',
        'responseHooks',
      ])
    ),
  }
}

function callRuntimeHooks(
  hooks: RuntimeHook[],
  plugins: App.Plugin[],
  config: RuntimeConfig,
  onError: (e: any) => void
) {
  for (const setup of hooks) {
    try {
      const newPlugins = toArray(setup(config))
      for (const plugin of newPlugins)
        if (typeof plugin == 'function') {
          plugins.push(plugin)
        }
    } catch (error: any) {
      onError(error)
    }
  }
}
