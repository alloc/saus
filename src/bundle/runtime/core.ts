// Redirect "saus/core" imports here.
export { render } from '../../core/render'
export { createPageFactory } from '../../pages'
export { setRenderModule, setRoutesModule } from '../../core/global'

// Ignore config hooks in SSR bundle.
export const addConfigHook = () => {}
