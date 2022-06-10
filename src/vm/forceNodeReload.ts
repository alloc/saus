import createDebug from 'debug'
import { Module } from 'module'
import { NodeModule } from './nodeModules'

const debug = createDebug('saus:forceNodeReload')

type ShouldReloadFn = (id: string, module: NodeModule) => boolean

export function forceNodeReload(shouldReload: ShouldReloadFn) {
  const rawCache = (Module as any)._cache as Record<string, NodeModule>

  // @ts-ignore
  Module._cache = new Proxy(rawCache, {
    get(_, id: string) {
      const cached = rawCache[id]
      if (!cached || !shouldReload(id, cached)) {
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
