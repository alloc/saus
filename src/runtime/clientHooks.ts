import { Promisable } from 'type-fest'
import { RenderRequest } from './renderer'

/**
 * UI framework plugins can extend this interface with declaration
 * merging to provide type safety to callers of the `defineLayout`
 * function.
 */
export interface ClientElement {}

export interface ClientHooks {
  /** This layout is about to be hydrated. */
  beforeHydrate?: (req: RenderRequest, root: ClientElement) => Promisable<void>
  /** This layout has finished hydrating. */
  afterHydrate?: (req: RenderRequest, root: ClientElement) => Promisable<void>
}
