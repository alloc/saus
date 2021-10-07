export type Deferred<T> = PromiseLike<T> & {
  resolve: T extends void
    ? (value?: PromiseLike<void>) => void
    : (value: T | PromiseLike<T>) => void
  promise: Promise<T>
}

export function defer<T>() {
  const result = {} as Deferred<T>
  const promise = new Promise<T>(resolve => {
    result.resolve = resolve as any
  })
  result.then = promise.then.bind(promise) as any
  result.promise = promise
  return result
}
