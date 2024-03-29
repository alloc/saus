import { toArray } from '@utils/array'
import { baseToRegex } from '@utils/base'
import { defineLazy } from '@utils/defineLazy'
import { klona } from '@utils/klona'
import { pick } from '@utils/pick'
import { plural } from '@utils/plural'
import { RuntimeConfig, RuntimeHook } from '../config'
import { debug } from '../debug'
import { Endpoint } from '../endpoint'
import { setRoutesModule } from '../global'
import { applyHtmlProcessors, mergeHtmlProcessors } from '../html/process'
import { matchRoute } from '../routes/matchRoute'
import { Route, RouteEndpointMap } from '../routeTypes'
import { emptyArray } from './constants'
import { defineBuiltinRoutes } from './internal/builtinRoutes'
import { wrapEndpoints } from './internal/endpoints'
import { createPagePropsLoader } from './internal/loadPageProps'
import { getPageFactory } from './internal/renderPage'
import { getPageStateFactory } from './internal/renderPageState'
import { getStateModuleFactory } from './internal/renderStateModule'
import { createNegotiator } from './negotiator'
import { App, RenderedPage, RouteResolver } from './types'

/**
 * Create a Saus application that can run anywhere. It can render pages
 * and find matching routes/endpoints. Only loaded state modules are cached.
 *
 * Note: This function does not use Vite for anything.
 */
export function createApp(ctx: App.Context, plugins: App.Plugin[] = []): App {
  const { config } = ctx

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

  const resolveRoute: RouteResolver = (url, routes = ctx.routes) => {
    const negotiate = createNegotiator(url.headers.accept)
    const routedPath = debugBaseRE
      ? url.path.replace(debugBaseRE, '/')
      : url.path

    let route: Route | undefined
    for (let i = routes.length; --i >= 0; ) {
      const route = routes[i]
      const params = matchRoute(routedPath, route)
      if (params) {
        const functions = resolveEndpoints(route, url.method, negotiate)
        if (functions) {
          url.routeParams = params
          return { route, functions, remainingRoutes: routes.slice(i + 1) }
        }
      }
    }
    if ((route = ctx.defaultRoute)) {
      const functions = resolveEndpoints(route, url.method, negotiate)
      if (functions) {
        return { route, functions, remainingRoutes: emptyArray }
      }
    }
    return {
      route: undefined,
      functions: emptyArray,
      remainingRoutes: emptyArray,
    }
  }

  const app = {
    config,
    resolveRoute,
    getEndpoints: null,
  } as App

  defineLazy(app, {
    catchRoute: () => ctx.catchRoute,
    defaultRoute: () => ctx.defaultRoute,
    callEndpoints: () => wrapEndpoints(app, ctx),
    renderPage: () => getPageFactory(app, ctx),
    renderPageState: () => getPageStateFactory(app, ctx),
    renderStateModule: () => getStateModuleFactory(ctx),
    loadPageProps: () => createPagePropsLoader(ctx),
    preProcessHtml: () =>
      ctx.htmlProcessors &&
      mergeHtmlProcessors(ctx.htmlProcessors, page => ({ page, config }), [
        'pre',
        'default',
      ]),
    postProcessHtml() {
      const htmlPostProcessors = ctx.htmlProcessors?.post
      return (
        htmlPostProcessors &&
        ((page: RenderedPage, timeout = config.htmlTimeout) =>
          applyHtmlProcessors(
            page.html,
            htmlPostProcessors,
            { page, config },
            timeout
          ))
      )
    },
  })

  // Use an isolated context for each `createApp` instance, since
  // runtime hooks can define anything the routes module can.
  ctx = cloneRouteContext(ctx)

  setRoutesModule(ctx)
  prepareApp(app, ctx, plugins)
  setRoutesModule(null)

  const routeCount = ctx.routes.length + (ctx.defaultRoute ? 1 : 0)
  debug('Created app with %s', plural(routeCount, 'route'))

  return app
}

function prepareApp(app: App, ctx: App.Context, plugins: App.Plugin[]) {
  callRuntimeHooks(ctx.runtimeHooks, plugins, ctx.config, ctx.onError)
  defineBuiltinRoutes(app, ctx)
  plugins.forEach(plugin => {
    const overrides = plugin(app)
    if (overrides)
      for (const [key, value] of Object.entries(overrides)) {
        Object.defineProperty(app, key, {
          value,
          enumerable: true,
          configurable: true,
        })
      }
  })
}

type ContentNegotiater = (provided: string[]) => string[]

function cloneRouteContext(ctx: App.Context): App.Context {
  return {
    ...ctx,
    ...klona(pick(ctx, ['htmlProcessors', 'requestHooks', 'responseHooks'])),
    defaultState: ctx.defaultState && [...ctx.defaultState],
    routes: [...ctx.routes],
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
