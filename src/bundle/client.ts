export { render } from '../core/render'
export { route, matchRoute } from '../core/routes'
export { setRenderModule, setRoutesModule } from '../core/global'
export type { RenderModule, RoutesModule } from '../core'

// Ignore config hooks in SSR bundle.
export const addConfigHook = () => {}
