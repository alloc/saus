import { Module } from 'module'
import createDebug from 'debug'

const debug = createDebug('saus:forceNodeReload')

export function forceNodeReload(shouldReload: (id: string) => boolean) {
  const rawCache = (Module as any)._cache as Record<string, NodeModule>

  // @ts-ignore
  Module._cache = new Proxy(rawCache, {
    get(_, id: string) {
      const cached = rawCache[id]
      if (!cached || !shouldReload(id)) {
        return cached
      }
      debug('Forcing reload: %s', id)
      delete rawCache[id]
    },
  })

  return () => {
    // @ts-ignore
    Module._cache = rawCache
  }
}
