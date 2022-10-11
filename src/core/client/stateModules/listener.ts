import { Cache, globalCache } from '@/runtime/cache'

export function hydrateStateListener(id: string, listener: Cache.Listener) {
  const keyPattern = new RegExp(`^${id}(\\.\\d+)?$`)
  for (const key in globalCache.loaded) {
    if (keyPattern.test(key)) {
      const [state, expiresAt, args] = globalCache.loaded[key]
      listener(args, state, expiresAt)
    }
  }
}
