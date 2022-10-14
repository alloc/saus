export function memoizeFn<T, Args extends any[], Return>(
  fn: T,
  call: (fn: T, ...args: Args) => Return
): (...args: Args) => Return {
  const cache = new Map<string, any>()
  return (...args: Args) => {
    const cacheKey = JSON.stringify(args)
    if (!cache.has(cacheKey)) {
      const result = call(fn, ...args)
      cache.set(cacheKey, result)
      return result
    }
    return cache.get(cacheKey)
  }
}
