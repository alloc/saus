// These exports are suitable to import from modules that
// run in SSR bundles and/or during static builds.
export { render } from './render'
export { route } from './routes'
export { beforeRender } from './core/render'
export { includeState } from './core/state'
export { resolveModules } from './utils/resolveModules'
export { escape } from './utils/escape'
