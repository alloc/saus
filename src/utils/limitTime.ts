type Promisable<T> = T | PromiseLike<T>

export function limitTime<T>(
  promise: Promisable<T>,
  secs: number,
  reason?: string
): Promise<T> {
  if (!(promise instanceof Promise)) {
    return Promise.resolve(promise)
  }
  if (secs <= 0) {
    return promise
  }
  const trace = Error(reason || 'Timed out')
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(trace), secs * 1e3)
    promise.then(resolve, reject).finally(() => clearTimeout(id))
  })
}
