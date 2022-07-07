import type { BufferLike } from './app/types'
import type { CommonClientProps } from './client'
import type { RouteModule, RouteParams } from './routes'
import { AnyToObject } from './utils/types'

/**
 * An isomorphic object describing an HTML request.
 */
export interface RenderRequest<
  Props extends object = any,
  Module extends object = any,
  Params extends object = any
> {
  /** The entry module imported by the route */
  module: AnyToObject<Module, RouteModule>
  /** Named strings extracted with a route pattern */
  params: AnyToObject<Params, RouteParams>
  /** The pathname from the URL (eg: `/a?b=1` → `"/a"`) */
  path: string
  /** Page props provided by the route */
  props: CommonClientProps & AnyToObject<Props>
  /** The search query from the URL (eg: `/a?b=1` → `"b=1"`) */
  query?: string
}

export type RenderApi = {
  emitFile(id: string, mime: string, data: BufferLike): void
}
