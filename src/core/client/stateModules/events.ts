import { globalCache } from '@/runtime/cache'
import type { StateModule } from '@/runtime/stateModules'

const listenerSets: Record<string, Set<StateModule.LoadCallback>> = {}

export function createStateListener(
  id: string,
  callback: StateModule.LoadCallback
): StateModule.LoadListener {
  const keyPattern = new RegExp(`^${id}(\\.\\d+)?$`)
  for (const key in globalCache.loaded) {
    if (keyPattern.test(key)) {
      const [state, expiresAt, args] = globalCache.loaded[key]
      callback(args, state, expiresAt)
    }
  }
  const callbacks = (listenerSets[id] ||= new Set())
  callbacks.add(callback)
  return {
    dispose: () => callbacks.delete(callback),
  }
}

export function notifyStateListeners(
  id: string,
  args: readonly any[],
  state: any,
  expiresAt: number | undefined
): void {
  listenerSets[id]?.forEach(callback => callback(args, state, expiresAt))
}
