import { Headers, normalizeHeaders } from '@/http'
import QuickLRU, { Options } from 'quick-lru'
import { getModuleUrl } from '../getModuleUrl'
import type { ClientModule } from '../types'

type BoundHeadersFn = () => Headers | null | undefined
type HeadersParam =
  | Headers
  | null
  | ((url: string) => Headers | null | undefined)

export interface FileCache extends QuickLRU<string, FileCacheEntry> {
  addModules(module: Set<ClientModule>, headers?: HeadersParam): void
  addAssets(assets: Map<string, Buffer>, headers?: HeadersParam): void
}

export type FileCacheOptions = Options<string, FileCacheEntry>

export type FileCacheEntry = [
  data: string | Buffer,
  headers: BoundHeadersFn | null | undefined
]

export function createFileCache(base: string, options?: FileCacheOptions) {
  const cache = new QuickLRU({ maxSize: 200, ...options }) as FileCache

  cache.addModules = (modules, headers) =>
    modules.forEach(module => {
      const url = getModuleUrl(module, base)
      if (!cache.has(url)) {
        cache.set(url, [
          module.text,
          headers && resolveHeaders.bind(null, headers, url),
        ])
      }
    })

  cache.addAssets = (assets, headers) =>
    assets.forEach((data, assetId) => {
      const url = base + assetId
      if (!cache.has(url)) {
        cache.set(url, [
          data,
          headers && resolveHeaders.bind(null, headers, url),
        ])
      }
    })

  return cache
}

function resolveHeaders(
  headers: HeadersParam | undefined,
  url: string
): Headers | null | undefined {
  if (typeof headers == 'function') {
    headers = headers(url)
  }
  return normalizeHeaders(headers)
}
