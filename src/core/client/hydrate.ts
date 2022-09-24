import type { CommonClientProps, RenderRequest } from '../core'
import { globalCache } from '../runtime/cache'
import type { RouteLayout } from '../runtime/layouts'

export type Hydrator<RenderResult = any> = (
  root: HTMLElement,
  content: RenderResult,
  request: RenderRequest
) => Promise<void> | void

export interface RouteClient {
  hydrate: Hydrator
  layout: Pick<RouteLayout, 'render' | 'clientHooks'>
  routeModule: object
}

export const defineHydrator = <RenderResult = any>(
  hydrate: Hydrator<RenderResult>
) => hydrate

export async function hydrate(
  { hydrate, layout, routeModule }: RouteClient,
  props: CommonClientProps,
  root: HTMLElement
) {
  // Cache page props in global cache.
  const path = location.pathname
  globalCache.loaded[path] = [props] // TODO: should this expire?

  const req: RenderRequest = {
    path,
    query: location.search.slice(1),
    params: props.routeParams,
    module: routeModule,
    props,
  }

  const content = await layout.render(req)

  const { beforeHydrate, afterHydrate } = layout.clientHooks || {}
  if (beforeHydrate) {
    await beforeHydrate(req, root)
  }

  await hydrate(root, content, req)
  saus.hydrated = true

  if (afterHydrate) {
    await afterHydrate(req, root)
  }
}
