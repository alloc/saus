import { AnyToObject } from '@utils/types'
import type { RouteParams } from '../../routes'

export type AnyClientProps = CommonClientProps & Record<string, any>

/** JSON state provided by the renderer and made available to the client */
export interface CommonClientProps<Params extends object = any> {
  rootId?: string
  routePath: string
  routeParams: AnyToObject<Params, RouteParams>
  error?: any
}

export type { RouteModule, RouteParams } from '../../routes'
export type { RenderRequest } from '../renderer'
