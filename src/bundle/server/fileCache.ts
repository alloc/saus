import { gray } from 'kleur/colors'
import QuickLRU, { Options } from 'quick-lru'
import { getModuleUrl } from '../getModuleUrl'
import type { ClientAsset, ClientModule } from '../types'
import { debug } from './debug'

export interface FileCache extends QuickLRU<string, string | ClientAsset> {
  addModules(module: Set<ClientModule>): void
  addAssets(assets: Map<string, ClientAsset>): void
}

export type FileCacheOptions = Options<string, string | ClientAsset>

export function createFileCache(base: string, options?: FileCacheOptions) {
  const cache = new QuickLRU({ maxSize: 200, ...options }) as FileCache

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
