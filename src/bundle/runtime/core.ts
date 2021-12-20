// Redirect "saus/core" imports here.
export { render, RenderModule } from '../../core/render'
export { matchRoute, RoutesModule } from '../../core/routes'
export { setRenderModule, setRoutesModule } from '../../core/global'

// Ignore config hooks in SSR bundle.
export const addConfigHook = () => {}
