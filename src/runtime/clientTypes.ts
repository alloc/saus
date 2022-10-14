import { AnyToObject } from '@utils/types'
import type { RouteParams } from './routeTypes'

export type AnyClientProps = CommonClientProps & Record<string, any>

/** JSON state provided by the renderer and made available to the client */
export interface CommonClientProps<Params extends object = any> {
  rootId?: string
  routePath: string
  routeParams: AnyToObject<Params, RouteParams>
  error?: any
}
