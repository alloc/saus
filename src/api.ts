// These exports are suitable to import from modules that
// run in SSR bundles and/or during static builds.
export { render } from './render'
export { route, generateRoute } from './routes'
export { beforeRender } from './core/render'
export { includeState } from './core/includeState'
export { escape, resolveModules } from './core/utils'
