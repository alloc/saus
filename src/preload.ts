import * as vite from 'vite'
import { isCSSRequest } from './utils/isCSSRequest'

export async function collectCss(
  mod: vite.ModuleNode,
  server: vite.ViteDevServer,
  urls = new Set<string>(),
  seen = new Set<string>()
) {
  if (mod.url && !seen.has(mod.url)) {
    seen.add(mod.url)
    if (isCssModule(mod)) {
      urls.add(mod.url)
    }
    if (!mod.transformResult) {
      await server.transformRequest(mod.url)
    }
    mod.importedModules.forEach(dep => {
      collectCss(dep, server, urls, seen)
    })
  }
  return urls
}

function isCssModule(mod: vite.ModuleNode) {
  return isCSSRequest(mod.url) || (mod.id && /\?vue&type=style/.test(mod.id))
}
