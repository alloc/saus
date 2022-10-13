import type { RenderedPage } from './app/types'
import type { Endpoint } from './endpoint'

/**
 * Custom metadata about an `Endpoint.Request` object
 */
export interface RequestMetadata {
  page?: RenderedPage
}

const metadataCache = new WeakMap<Endpoint.Request<any>, RequestMetadata>()

export function getRequestMetadata(req: Endpoint.Request<any>) {
  return metadataCache.get(req)!
}

export function setRequestMetadata(
  req: Endpoint.Request<any>,
  data: RequestMetadata
) {
  metadataCache.set(req, {
    ...metadataCache.get(req),
    ...data,
  })
}
