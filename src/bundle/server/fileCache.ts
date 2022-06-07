import QuickLRU, { Options } from 'quick-lru'
import { Headers, normalizeHeaders } from '../../http'
import { getModuleUrl } from '../getModuleUrl'
import type { ClientAsset, ClientModule } from '../types'

type FileHeaders =
  | Headers
  | null
  | ((url: string) => Headers | null | undefined)

export interface FileCache extends QuickLRU<string, FileCacheEntry> {
  addModules(module: Set<ClientModule>, headers?: FileHeaders): void
  addAssets(assets: Map<string, ClientAsset>, headers?: FileHeaders): void
}

export type FileCacheOptions = Options<string, FileCacheEntry>

export type FileCacheEntry = [
  data: string | ClientAsset,
  headers: Headers | null | undefined
]

export function createFileCache(base: string, options?: FileCacheOptions) {
  const cache = new QuickLRU({ maxSize: 200, ...options }) as FileCache

  cache.addModules = (modules, headers) =>
    modules.forEach(module => {
      const url = getModuleUrl(module, base)
      if (!cache.has(url)) {
        const resolvedHeaders = resolveHeaders(headers, url)
        cache.set(url, [module.text, resolvedHeaders])
      }
    })

  cache.addAssets = (assets, headers) =>
    assets.forEach((data, assetId) => {
      const url = base + assetId
      if (!cache.has(url)) {
        const resolvedHeaders = resolveHeaders(headers, url)
        cache.set(url, [data, resolvedHeaders])
      }
    })

  return cache
}

function resolveHeaders(
  headers: FileHeaders | undefined,
  url: string
): Headers | null | undefined {
  if (typeof headers == 'function') {
    headers = headers(url)
  }
  return normalizeHeaders(headers)
}
