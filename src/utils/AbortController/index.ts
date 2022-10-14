export type AbortController = import('./types').AbortController
export const AbortController =
  globalThis.AbortController as typeof import('./types').AbortController

export type AbortSignal = import('./types').AbortSignal
export const AbortSignal =
  globalThis.AbortSignal as typeof import('./types').AbortSignal
