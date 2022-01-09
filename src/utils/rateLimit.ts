import { defer, Deferred } from './defer'

type AsyncFn = (...args: any[]) => Promise<any>
type QueuedCall = Deferred<any> & { args: any[] }

export type RateLimited<T extends AsyncFn> = T & {
  calls?: Promise<void>
}

export function rateLimit<T extends AsyncFn>(
  limit: number,
  fn: T,
  pre?: (...args: Parameters<T>) => void
): RateLimited<T> {
  let deferred: Deferred<void>
  const activeCalls = new Set<any[]>()
  const queuedCalls: QueuedCall[] = []

  async function invoke(args: any[]) {
    activeCalls.add(args)
    try {
      return await fn(...args)
    } finally {
      activeCalls.delete(args)
      const call = queuedCalls.shift()
      if (call) {
        call.resolve(invoke(call.args))
      } else if (activeCalls.size == 0) {
        deferred.resolve()
      }
    }
  }

  function wrapper(...args: any[]) {
    pre?.(...(args as Parameters<T>))
    if (activeCalls.size == limit) {
      const call = defer() as QueuedCall
      call.args = args
      queuedCalls.push(call)
      return call.promise
    }
    if (activeCalls.size == 0) {
      deferred = defer()
    }
    return invoke(args)
  }

  Object.defineProperty(wrapper, 'calls', {
    get: () => deferred?.promise,
  })

  return wrapper as any
}
