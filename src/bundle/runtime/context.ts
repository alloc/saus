import type { RuntimeHook } from '../../core/setup'
import type { PageFactoryContext } from '../../pages'

export const context: PageFactoryContext = {
  pages: {},
  states: {},
  logger: { warn: console.warn },
  beforeRenderHooks: [],
  runtimeHooks: [],
  renderers: [],
  routes: [],
}

export function setup(hook: RuntimeHook) {
  context.runtimeHooks.push(hook)
}
