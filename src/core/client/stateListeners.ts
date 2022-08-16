import type { StateModule } from '@/runtime/stateModules'

const listenerSets: Record<string, Set<StateModule.LoadCallback>> = {}

export function createStateListener(
  id: string,
  callback: StateModule.LoadCallback
): StateModule.LoadListener {
  const callbacks = (listenerSets[id] ||= new Set())
  callbacks.add(callback)
  return {
    dispose: () => callbacks.delete(callback),
  }
}

export async function notifyStateListeners(
  id: string,
  args: readonly any[],
  state: any,
  expiresAt: number | undefined
): Promise<void> {
  if (listenerSets[id])
    await Promise.all(
      Array.from(listenerSets[id], callback => callback(args, state, expiresAt))
    )
}
