import type { StateModule } from './stateModules'

export function createStateListener<Args extends any[]>(
  key: string,
  callback: StateModule.LoadCallback<any, Args>
): StateModule.LoadListener {
  // Do nothing in SSR context.
  return { dispose() {} }
}
