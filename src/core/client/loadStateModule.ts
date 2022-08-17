// Overrides "src/core/runtime/loadStateModule.ts" module in client builds
import { globalCache } from '@/runtime/cache'
import { getLoadedStateOrThrow } from '@/runtime/getLoadedStateOrThrow'
import type { StateModule } from '@/runtime/stateModules'
import { getStateModuleKey } from '../runtime/getStateModuleKey'
import { prependBase } from './prependBase'

/**
 * Deep-copying is skipped in the client implementation.
 *
 * See the server-side implementation for more info.
 */
export function loadStateModule(
  module: StateModule,
  args: readonly any[],
  sync?: true
) {
  const cacheKey = getStateModuleKey(module, args)

  if (sync) {
    return getLoadedStateOrThrow(cacheKey, args)
  }

  return globalCache.access(cacheKey, async cacheControl => {
    const stateUrl = prependBase(saus.stateModuleBase + cacheKey + '.js')
    if (import.meta.env.DEV) {
      // Ensure this module is ready to serve.
      await fetch(prependBase('/.saus/state'), {
        method: 'POST',
        body: JSON.stringify([module.id, args]),
      })
    }
    await import(/* @vite-ignore */ stateUrl)
    const [state, expiresAt] = globalCache.loaded[cacheKey]
    if (expiresAt != null) {
      cacheControl.maxAge = (expiresAt - Date.now()) / 1e3
    }
    return state
  })
}
