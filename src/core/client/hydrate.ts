import type { CommonClientProps, RenderRequest } from '../core'
import { globalCache } from '../runtime/cache'
import type { RouteLayout } from '../runtime/layouts'
import { getPageFilename } from '../utils/getPageFilename'
import routes from './routes'

export type Hydrator<RenderResult = any> = (
  root: HTMLElement,
  content: RenderResult,
  request: RenderRequest
) => Promise<void> | void

export interface RouteClient {
  route: { url: string; module: object }
  layout: Pick<RouteLayout, 'render' | 'clientHooks'>
  hydrate: Hydrator
}

export const defineHydrator = <RenderResult = any>(
  hydrate: Hydrator<RenderResult>
) => hydrate

export async function hydrate(
  { route, layout, hydrate }: RouteClient,
  props: CommonClientProps,
  root: HTMLElement
) {
  // Update client routes map.
  routes[props.routePath] = route.url

  // Cache page props in global cache.
  const path = location.pathname
  globalCache.loaded[path] = [props]

  const req: RenderRequest = {
    path,
    file: getPageFilename(path, import.meta.env.BASE_URL),
    query: location.search.slice(1),
    params: props.routeParams,
    module: route.module,
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
