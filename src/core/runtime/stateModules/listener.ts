import type { Cache } from '@/runtime/cache'

export function hydrateStateListener(id: string, listener: Cache.Listener) {
  // Do nothing in a server context.
}
