import { gray } from 'kleur/colors'
import { getModuleUrl } from '../getModuleUrl'
import type { ClientAsset, ClientModule } from '../types'
import { debug } from './debug'

export interface FileCache extends Map<string, string | ClientAsset> {
  addModules(module: Set<ClientModule>): void
  addAssets(assets: Map<string, ClientAsset>): void
}

export function createFileCache(base: string) {
  const cache = new Map() as FileCache

  cache.addModules = modules =>
    modules.forEach(module => {
      const url = getModuleUrl(module, base)
      if (!cache.has(url)) {
        debug(gray('loaded'), url)
        cache.set(url, module.text)
      }
    })

  cache.addAssets = assets =>
    assets.forEach((data, assetId) => {
      const url = base + assetId
      if (!cache.has(url)) {
        debug(gray('loaded'), url)
        cache.set(url, data)
      }
    })

  return cache
}
