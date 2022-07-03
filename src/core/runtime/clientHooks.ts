import { Promisable } from 'type-fest'
import { RenderRequest } from '../renderer'

export interface ClientHooks {
  /** This layout is about to be hydrated. */
  beforeHydrate?: (req: RenderRequest, root: HTMLElement) => Promisable<void>
  /** This layout has finished hydrating. */
  afterHydrate?: (req: RenderRequest, root: HTMLElement) => Promisable<void>
}

export function defineClientHooks(hooks: ClientHooks) {
  return hooks
}
