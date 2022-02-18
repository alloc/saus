type Promisable<T> = T | PromiseLike<T>

export const limitTime = <T>(
  promise: Promisable<T>,
  secs: number,
  reason?: string
) =>
  secs <= 0 || !(promise instanceof Promise)
    ? promise
    : Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          const id = setTimeout(() => reject(reason || 'Timed out'), secs * 1e3)
          promise.finally(() => clearTimeout(id))
        }),
      ])
