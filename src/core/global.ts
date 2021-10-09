import type { SausContext } from './context'

export let context: SausContext

export const setContext = (newContext: SausContext | null) =>
  // Avoid ! assertions everywhere by assuming the context
  // is always defined (even though it's not).
  void (context = newContext as any)
