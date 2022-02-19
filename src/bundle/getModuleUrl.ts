import { ClientModule } from './types'

const htmlExtension = '.html'
const indexHtmlSuffix = '/index.html'

/**
 * If you want to cache modules in-memory and serve them, this function
 * will be helpful. It returns the URL pathname that your server should
 * respond to for each module.
 */
export const getModuleUrl = (mod: ClientModule, base = '/') =>
  base +
  (mod.id.endsWith(htmlExtension)
    ? ('/' + mod.id).endsWith(indexHtmlSuffix)
      ? mod.id.slice(0, 1 - indexHtmlSuffix.length)
      : mod.id.slice(0, -htmlExtension.length)
    : mod.id)
