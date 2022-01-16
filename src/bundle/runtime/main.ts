import { createPageFactory } from '../../pages'
import config from './config'
import { context } from './context'
import functions from './functions'

export { renderPage as default } from './pages'
export { default as moduleMap } from './modules'
export { getKnownPaths } from './paths'
export { getModuleUrl } from './getModuleUrl'
export { printFiles, writePages } from '../../build/write'

/** @internal */
export const getPageFactory = (setup?: () => Promise<any>) =>
  createPageFactory(context, functions, config, setup)
