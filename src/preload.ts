import * as vite from 'vite'

export function collectCss(
  mod: vite.ModuleNode,
  urls = new Set<string>(),
  seen = new Set<string>()
) {
  if (mod.url && !seen.has(mod.url)) {
    seen.add(mod.url)
    if (isCssModule(mod)) {
      urls.add(mod.url)
    }
    mod.importedModules.forEach(dep => {
      collectCss(dep, urls, seen)
    })
  }
  return urls
}

function isCssModule(mod: vite.ModuleNode) {
  return mod.url.endsWith('.css') || (mod.id && /\?vue&type=style/.test(mod.id))
}
