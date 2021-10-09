import fs from 'fs'
import path from 'path'

export const getCachePath = (root: string) =>
  path.join(root, 'node_modules/.saus')

export type CachedModule = {
  ast: any
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
  fs.writeFileSync(cachePath, JSON.stringify(cache))
}
