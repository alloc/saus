type Promisable<T> = T | PromiseLike<T>

export function limitTime<T>(
  promise: Promisable<T>,
  secs: number,
  reason?: string
): Promise<T> {
  if (secs <= 0 || !(promise instanceof Promise)) {
    return Promise.resolve(promise)
  }
  const trace = Error(reason || 'Timed out')
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const id = setTimeout(() => reject(trace), secs * 1e3)
      promise.finally(() => clearTimeout(id))
    }),
  ])
}
