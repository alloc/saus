import { defer, Deferred } from './defer'

type AsyncFn = (...args: any[]) => Promise<any>
type QueuedCall = Deferred<any> & { args: any[] }

export type QueuedFunction<T extends AsyncFn> = T & {
  calls?: Promise<void>
}

export function limitByQueue<T extends AsyncFn>(
  shouldQueue: (activeCalls: ReadonlySet<any[]>, args: any[]) => boolean,
  fn: T,
  pre?: (...args: Parameters<T>) => void
): QueuedFunction<T> {
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
    if (shouldQueue(activeCalls, args)) {
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
