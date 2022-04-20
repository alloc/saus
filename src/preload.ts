import * as vite from 'vite'
import { isCSSRequest } from './utils/isCSSRequest'

export async function collectCss(
  mod: vite.ModuleNode,
  server: vite.ViteDevServer,
  urls = new Set<vite.ModuleNode>(),
  seen = new Set<string>()
) {
  if (mod.url && !seen.has(mod.url)) {
    seen.add(mod.url)
    if (isCssModule(mod)) {
      urls.add(mod)
    }
    if (!mod.transformResult) {
      await server.transformRequest(mod.url.replace(/^\/@id\//, ''))
    }
    await Promise.all(
      Array.from(mod.importedModules, dep => {
        return collectCss(dep, server, urls, seen)
      })
    )
  }
  return urls
}

function isCssModule(mod: vite.ModuleNode) {
  return isCSSRequest(mod.url) || (mod.id && /\?vue&type=style/.test(mod.id))
}
