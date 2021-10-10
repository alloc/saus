import fs from 'fs'
import path from 'path'

export const getCachePath = (root: string) =>
  path.join(root, 'node_modules/.saus')

export type CachedModule = {
  id: string
  originalCode: string
}

export type Cache = {
  modules: CachedModule[]
}

export const readCache = (cachePath: string) => {
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8')) as Cache
  } catch {}
}

export const writeCache = (cachePath: string, cache: Cache) => {
  // Ensure "transformIndexHtml" hooks are always called.
  cache.modules = cache.modules.filter(mod => !mod.id.endsWith('.html'))
  fs.writeFileSync(cachePath, JSON.stringify(cache))
}
