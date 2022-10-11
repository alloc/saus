// Overrides "src/core/runtime/loadStateModule.ts" module in client builds
import { Cache, globalCache } from '@/runtime/cache'
import { getLoadedStateOrThrow } from '@/runtime/getLoadedStateOrThrow'
import { getStateModuleKey } from '@/runtime/getStateModuleKey'
import type { StateModule } from '@/runtime/stateModules'
import { noop } from '@/utils/noop'
import { sortObjects } from '@/utils/sortObjects'
import saus from '../context'
import { prependBase } from '../prependBase'

export function getState<T, Args extends readonly any[]>(
  cache: Cache,
  module: StateModule<T, Args>,
  args: Args
) {
  const key = getStateModuleKey(module, args)
  return getLoadedStateOrThrow(cache, key, args)
}

export const serveState = noop

/**
 * Deep-copying is skipped in the client implementation.
 *
 * See the server-side implementation for more info.
 */
export function loadStateModule(
  cache: Cache,
  module: StateModule | string,
  args: readonly any[],
) {
  const sortedArgsPayload = JSON.stringify(args, sortObjects)
  const key = getStateModuleKey(module, sortedArgsPayload)

  return cache.access(key, async () => {
    const stateUrl = prependBase(saus.stateModuleBase + key + '.js')
    const resp = await fetch(stateUrl, {
      headers: { 'x-args': btoa(sortedArgsPayload) },
    })
    if (resp.status !== 200) {
      throw Error(`[${resp.status}] Failed to load state module "${stateUrl}"`)
    }

    // I'd prefer to just use dynamic import here, but it doesn't let us
    // set the request headers, which is needed for on-demand modules.
    const tag = document.createElement('script')
    const code = await resp.text()
    await new Promise(onLoad => {
      tag.id = key
      tag.type = 'module'
      tag.onload = onLoad
      tag.textContent =
        code + `\ndocument.getElementById("${key}").onload()`
      document.head.appendChild(tag)
    })
    tag.remove()

    // Skip updating the cache and use the cache entry that was
    // injected by the script we just evaluated.
    return Symbol.for('skip')
  })
}

/**
 * Note: This doesn't support on-demand state modules, so it should
 * only be used for state modules coupled to the page's route, which
 * means the state module is loaded unconditionally when the page
 * is requested.
 */
export function importStateModules(...args: any[]) {
  return Promise.all(
    args.map(async cacheKey => {
      const [state] = await globalCache.access(cacheKey, async () => {
        const stateUrl = prependBase(saus.stateModuleBase + cacheKey + '.js')
        await import(/* @vite-ignore */ stateUrl)

        // Skip updating the cache and use the cache entry that was
        // injected by the module we just imported.
        return Symbol.for('skip')
      })
      return state
    })
  )
}
