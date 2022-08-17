import type { StateModule } from './stateModules'

export function createStateListener<Args extends readonly any[]>(
  key: string,
  callback: StateModule.LoadCallback<any, Args>
): StateModule.LoadListener {
  // Do nothing in SSR context.
  return { dispose() {} }
}

export function notifyStateListeners(
  id: string,
  args: readonly any[],
  state: any,
  expiresAt: number | undefined
): void {
  // Do nothing in SSR context.
}
