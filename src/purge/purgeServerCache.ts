import { globalCache } from '@runtime/cache'
import { PurgePlugin } from './types'

export function purgeServerCache(): PurgePlugin {
  return {
    name: 'saus:server-cache',
    purge(request) {
      if (request.globs.has('/*')) {
        return globalCache.clear()
      }
      // TODO: selective purge
    },
  }
}
