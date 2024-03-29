import { mergeArrays } from '@utils/array'
import { ascendBranch } from '@utils/ascendBranch'
import { pickAllExcept } from '@utils/pick'
import { Endpoint } from '../../endpoint'
import { Http } from '../../http'
import { DeclaredHeaders } from '../../http/headers'
import { makeRequest } from '../../makeRequest'
import { Route } from '../../routeTypes'
import { App } from '../types'

export const wrapEndpoints =
  (app: App, ctx: App.Context): App['callEndpoints'] =>
  async (url, resolved = app.resolveRoute(url)) => {
    let route = resolved.route
    let promise: Endpoint.ResponsePromise | undefined
    let response: Endpoint.Response | undefined
    let headers = new DeclaredHeaders(null)
    let request = makeRequest(
      url,
      function respondWith(arg1, body?: Endpoint.ResponseTuple[1]) {
        if (response) return
        if (arg1 instanceof Promise) {
          promise = arg1
        } else {
          response = createResponse(route, headers, arg1, body)
        }
      }
    )

    const callFunctions = async (
      functions: readonly Endpoint.Function[]
    ): Promise<void> => {
      for (const fn of functions) {
        const returned = await fn(request, headers, app)
        if (response) {
          break
        }
        if (promise) {
          const resolved = await promise
          promise = undefined
          if (resolved) {
            const [arg1, body] = resolved
            response = createResponse(route, headers, arg1, body)
            break
          }
        }
        if (returned) {
          if (returned instanceof Http.Redirect) {
            headers.location(returned.location)
            response = createResponse(route, headers, returned.status)
          } else {
            headers.merge(returned.headers)
            response = createResponse(route, headers, returned.status, {
              buffer: returned.data,
            })
          }
          break
        }
      }

      // If no response is created, try matching a remaining route.
      const routes = resolved.remainingRoutes
      if (!response && routes.length) {
        resolved = app.resolveRoute(url, routes)
        if ((route = resolved.route)) {
          return callFunctions(resolved.functions)
        }
      }
    }

    const functions = mergeArrays(
      // Global request hooks first.
      ctx.requestHooks,
      // Then top-down route-specific hooks.
      ...ascendBranch(
        resolved.route!,
        'parent',
        route => route.requestHooks
      ).reverse(),
      // Then the matched functions.
      resolved.functions
    )

    try {
      await callFunctions(functions)
    } catch (error: any) {
      // TODO: allow customization here
      const body =
        ctx.config.mode == 'development' ? { text: error.stack } : undefined
      response = createResponse(route, headers, 500, body)
      if (!body) {
        ctx.onError(error)
      }
    }

    if (response?.status) {
      const responseHooks = mergeArrays(
        // First bottom-up route-specific hooks.
        ...ascendBranch(
          resolved.route!,
          'parent',
          route => route.responseHooks
        ),
        // Then global response hooks.
        ctx.responseHooks
      )
      if (responseHooks.length)
        for (const onResponse of responseHooks) {
          await onResponse(request, response, app)
        }
    }

    return response || {}
  }

function createResponse(
  route: Route | undefined,
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
      if (!Object.keys(body).length) {
        body = undefined
      }
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
    body: body as Endpoint.AnyBody,
    route,
  }
}
