import { Endpoint } from '@/endpoint'
import { routesModule } from '@/global'
import type {
  InferRouteParams,
  ParsedRoute,
  Route,
  RouteConfig,
  RouteLoader,
} from '@/routes'
import { getCurrentModule, ssrImport } from '@/runtime/ssrModules'
import { httpMethods } from '@/utils/httpMethods'
import { parseRoutePath } from '@/utils/parseRoutePath'
import { relative } from '@cush/relative'

const importRE = /\b\(["']([^"']+)["']\)/
const parseDynamicImport = (fn: Function, path: string) => {
  try {
    return importRE.exec(fn.toString())![1]
  } catch (e: any) {
    throw Error(`Failed to parse "moduleId" for route: "${path}"\n` + e.message)
  }
}

const routeStack: Route[] = []
const privateRoute: ParsedRoute = {
  pattern: /^$/,
  keys: [],
}

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

/** Define a route */
export function route<RoutePath extends string, Module extends object>(
  path: RoutePath,
  config: RouteConfig<Module, InferRouteParams<RoutePath>>
): Route.API<InferRouteParams<RoutePath>>

/** @internal */
export function route(
  pathOrLoad: string | RouteLoader,
  maybeLoad?: RouteLoader<any> | RouteConfig<any, any>,
  config?: RouteConfig<any, any>
) {
  let path = typeof pathOrLoad == 'string' ? pathOrLoad : 'default'
  let load =
    typeof maybeLoad == 'function'
      ? maybeLoad
      : typeof pathOrLoad == 'function'
      ? pathOrLoad
      : undefined

  // A route is marked as "generated" when its entry module
  // isn't defined by a wrapped dynamic import call. In this
  // case, the module ID needs to be resolved manually.
  let generated = false
  let moduleId: string | null = null

  if (load == null && maybeLoad) {
    config = maybeLoad as RouteConfig
    if (typeof config.entry == 'function') {
      load = config.entry
    } else if (typeof config.entry == 'string') {
      generated = true
      moduleId = config.entry
    }
  }

  if (load) {
    moduleId = parseDynamicImport(load, path)
  } else if (moduleId) {
    const id = moduleId
    const importer = getCurrentModule()
    const { ssrRequire } = routesModule
    load = ssrRequire
      ? () => ssrRequire(id, importer, true)
      : () => {
          let resolvedId: string | null = id
          if (importer && /^\.\.?\//.test(id)) {
            resolvedId = relative(importer, id)
            if (!resolvedId)
              throw Error(
                `Cannot find module "${id}" imported by "${importer}"`
              )
          }
          return ssrImport(resolvedId)
        }
  } else {
    load = () => {
      throw Error(`Route "${path}" has no module defined`)
    }
  }

  const isPublic = path[0] === '/'
  if (isPublic && routeStack.length) {
    path = Array.from(routeStack, route => route.path).join('') + path
  }

  const { pattern, keys } = isPublic ? parseRoutePath(path) : privateRoute
  const self: Route = {
    ...config,
    path,
    load,
    generated,
    moduleId,
    pattern,
    keys,
  }

  if (isPublic) {
    routesModule.routes.push(self)
  } else {
    // TODO: support nesting of catch-all and error routes
    if (routeStack.length)
      throw Error(
        'Cannot set "default" or "error" route within `extend` callback'
      )

    if (path === 'default') {
      routesModule.defaultRoute = self
    } else if (path === 'error') {
      routesModule.catchRoute = self
    }
  }

  return createRouteAPI(self)
}

function createRouteAPI(parent: Route) {
  const api = {
    extend(cb) {
      const addRoute = ((...args: Parameters<typeof route>) => {
        routeStack.push(parent)
        route(...args)
        routeStack.pop()
      }) as typeof route

      routeStack.push(parent)
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
          fn = async (req, headers, app) => {
            const result = await arg2!(req, headers, app)
            if (result !== undefined) {
              req.respondWith(200, { json: result })
            }
          }
        }
        const nestedRoute = route(parent.path + nestedPath)
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

      parent.endpoints ||= []
      parent.endpoints.push(endpoint)

      return api
    }
  }

  return api
}
