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
  /** The pathname from the URL (eg: `/a?b=1` → `"/a"`) */
  path: string
  /** The `.html` file associated with this page */
  file: string
  /** The search query from the URL (eg: `/a?b=1` → `"b=1"`) */
  query?: string
  /** The entry module imported by the route */
  module: AnyToObject<Module, RouteModule>
  /** Page props provided by the route */
  props: CommonClientProps & AnyToObject<Props>
  /** Named strings extracted with a route pattern */
  params: AnyToObject<Params, RouteParams>
}

export type RenderApi = {
  emitFile(id: string, mime: string, data: BufferLike): void
}
