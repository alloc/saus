import type { RouteParams } from '../routes'

export type AnyClientProps = CommonClientProps & Record<string, any>

/** JSON state provided by the renderer and made available to the client */
export interface CommonClientProps<Params extends {} = RouteParams> {
  rootId?: string
  routePath: string
  routeParams: Params
  error?: any
}

export type { RenderRequest } from '../renderer'
export type { RouteModule, RouteParams } from '../routes'
