import { Endpoint } from '@/endpoint'
import { DeclaredHeaders, ResponseHeaders } from '@/http/headers'
import { HttpRedirect } from '@/http/redirect'
import { makeRequest } from '@/makeRequest'
import { pickAllExcept } from '@/utils/pick'
import { App, AppContext } from '../types'

export const wrapEndpoints =
  (app: App, ctx: AppContext): App['callEndpoints'] =>
  async (url, endpoints = app.resolveRoute(url)[0]) => {
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

    if (ctx.requestHooks) {
      endpoints = ctx.requestHooks.concat(endpoints)
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

    if (ctx.responseHooks && response?.status)
      for (const onResponse of ctx.responseHooks) {
        await onResponse(request, response, app)
      }

    return response || {}
  }

function createResponse(
  headers: DeclaredHeaders<ResponseHeaders | null>,
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
    body: body as Endpoint.AnyBody,
  }
}