import { ClientModule } from './types'

const htmlExtension = '.html'
const indexHtmlSuffix = '/index.html'

/**
 * If you want to cache modules in-memory and serve them, this function
 * will be helpful. It returns the URL pathname that your server should
 * respond to for each module.
 */
export function getModuleUrl(mod: ClientModule, base?: string | number) {
  // Ignore non-string base, so getModuleUrl can be passed to `Array.from`
  if (typeof base !== 'string') {
    base = '/'
  }

  const modulePath = mod.id.endsWith(htmlExtension)
    ? ('/' + mod.id).endsWith(indexHtmlSuffix)
      ? mod.id.slice(0, 1 - indexHtmlSuffix.length)
      : mod.id.slice(0, -htmlExtension.length)
    : mod.id

  return base + modulePath
}
