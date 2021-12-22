import { PageFactoryContext } from '../../pages'

export const context: PageFactoryContext = {
  pages: {},
  states: {},
  logger: { warn: console.warn },
  beforeRenderHooks: [],
  renderers: [],
  routes: [],
}
