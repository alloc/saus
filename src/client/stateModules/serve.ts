import { Cache, createCache } from '@runtime/cache'
import { getStateModuleKey } from '@runtime/getStateModuleKey'
import type { StateModule } from '@runtime/stateModules'
import { sortObjects } from '@utils/sortObjects'
import saus from '../context'
import { prependBase } from '../prependBase'

export const serveCache = createCache()

/**
 * Deep-copying is skipped in the client implementation.
 *
 * See the server-side implementation for more info.
 */
export function serveState(
  module: StateModule,
  options: Cache.AccessOptions = {}
) {
  const args = options.args || []
  const sortedArgsPayload = JSON.stringify(args, sortObjects)

  const key = getStateModuleKey(module, sortedArgsPayload)
  const loader = async () => {
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
      tag.textContent = code + `\ndocument.getElementById("${key}").onload()`
      document.head.appendChild(tag)
    })
    tag.remove()

    // Skip updating the cache and use the cache entry that was
    // injected by the script we just evaluated.
    return Symbol.for('skip')
  }

  return serveCache.access(key, loader, {
    ...options,
    stateModule: module,
    args,
  })
}
