import * as RegexParam from 'regexparam'
import { Endpoint } from './core/endpoint'
import { routesModule } from './core/global'
import type {
  GeneratedRouteConfig,
  InferRouteParams,
  Route,
  RouteConfig,
  RouteLoader,
} from './core/routes'
import { getStackFrame } from './utils/resolveStackTrace'
import { httpMethods } from './utils/httpMethods'

const importRE = /\b\(["']([^"']+)["']\)/
const parseDynamicImport = (fn: Function, path: string) => {
  try {
    return importRE.exec(fn.toString())![1]
  } catch (e: any) {
    throw Error(`Failed to parse "moduleId" for route: "${path}"\n` + e.message)
  }
}

const routeStack: Route[] = []

/** Define the default route */
export function route(load: RouteLoader): void

/** Define a catch route */
export function route<Module extends object>(
  path: 'error',
  load: RouteLoader<Module>,
  config?: RouteConfig<Module, { error: any }>
): void

/** Define a route */
export function route<RoutePath extends string, Module extends object>(
  path: RoutePath,
  load?: RouteLoader<Module>,
  config?: RouteConfig<Module, InferRouteParams<RoutePath>>
): Route.API<InferRouteParams<RoutePath>>

/** @internal */
export function route(
  pathOrLoad: string | RouteLoader,
  maybeLoad?: RouteLoader<any>,
  config?: RouteConfig<any, any>
) {
  let path = typeof pathOrLoad == 'string' ? pathOrLoad : 'default'
  let load =
    typeof pathOrLoad == 'string' ? maybeLoad : (pathOrLoad as RouteLoader)

  const routeDecl = {
    path,
    load,
    moduleId: load ? parseDynamicImport(load, path) : null,
    ...config,
  } as Route

  if (path[0] === '/') {
    if (routeStack.length) {
      routeDecl.path = path =
        Array.from(routeStack, route => route.path).join('') + path
    }

    Object.assign(routeDecl, RegexParam.parse(path))
    routesModule.routes.push(routeDecl)

    const api = {
      extend(cb) {
        const addRoute = ((...args: Parameters<typeof route>) => {
          routeStack.push(routeDecl)
          route(...args)
          routeStack.pop()
        }) as typeof route

        routeStack.push(routeDecl)
        try {
          const result = cb(addRoute)
          if (result instanceof Promise) {
            result.catch(console.error)
          }
        } finally {
          routeStack.pop()
        }
      },
    } as Route.API

    for (const method of httpMethods) {
      api[method] = (
        arg1: string | Endpoint.ContentType[] | typeof fn,
        arg2?: Endpoint.ContentType[] | typeof fn,
        fn?: Endpoint.Function
      ) => {
        let contentTypes: Endpoint.ContentType[]
        if (typeof arg1 == 'string') {
          const nestedPath = arg1
          if (Array.isArray(arg2)) {
            contentTypes = arg2
          } else {
            contentTypes = ['application/json']
            fn = async req => {
              const result = await arg2!(req)
              if (result !== undefined) {
                req.respondWith(200, null, { json: result })
              }
            }
          }
          const nestedRoute = route(path + nestedPath)
          nestedRoute[method](contentTypes as Endpoint.ContentTypes, fn!)
          return api
        }

        if (Array.isArray(arg1)) {
          contentTypes = arg1
          fn = arg2 as Endpoint.Function
        } else {
          contentTypes = ['*/*']
          fn = arg1
        }

        const endpoint = fn as Endpoint
        endpoint.method = method.toUpperCase()
        endpoint.contentTypes = contentTypes

        routeDecl.endpoints ||= []
        routeDecl.endpoints.push(endpoint)

        return api
      }
    }

    return api
  }

  if (routeStack.length)
    throw Error(
      'Cannot set "default" or "error" route within `extend` callback'
    )

  if (path === 'default') {
    routesModule.defaultRoute = routeDecl
  } else if (path === 'error') {
    routesModule.catchRoute = routeDecl
  }
}

/** Define a route */
export function generateRoute<RoutePath extends string, Module extends object>(
  path: RoutePath,
  {
    entry,
    ...config
  }: GeneratedRouteConfig<Module, InferRouteParams<RoutePath>>
): void {
  const importer = getStackFrame(2)?.file
  const ssrRequire = routesModule.ssrRequire!

  let moduleId: string
  let load: () => Promise<any>
  if (typeof entry == 'string') {
    moduleId = entry
    load = () => ssrRequire(entry, importer, true)
  } else {
    moduleId = parseDynamicImport(entry, path)
    load = entry
  }

  routesModule.routes.push({
    ...(config as RouteConfig),
    ...RegexParam.parse(path),
    path,
    load,
    moduleId,
    generated: true,
  })
}

export function onRequest(hook: Endpoint.Function) {
  routesModule.requestHooks ||= []
  routesModule.requestHooks.push(hook)
}

export function onResponse(hook: Endpoint.ResponseHook) {
  routesModule.responseHooks ||= []
  routesModule.responseHooks.push(hook)
}
