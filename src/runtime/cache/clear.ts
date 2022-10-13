import { Cache } from './types'

/**
 * Traverse the given cache, removing any keys that match.
 */
export function clear(
  this: Cache<any>,
  filter: string | ((key: string) => boolean) = () => true
) {
  const stores = [this.loaded, this.loading]
  if (typeof filter == 'function') {
    for (const store of stores) {
      for (const key of Object.keys(store)) {
        if (filter(key)) {
          delete store[key]
        }
      }
    }
  } else {
    for (const store of stores) {
      delete store[filter]
    }
  }
}
