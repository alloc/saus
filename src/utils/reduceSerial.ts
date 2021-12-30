type Promisable<T> = T | PromiseLike<T>

export async function reduceSerial<T, U>(
  array: readonly T[],
  reducer: (result: U, element: T) => Promisable<U | null | void>,
  init: U
): Promise<U> {
  let reduced = init
  for (const element of array) {
    const result = await reducer(reduced, element)
    if (result != null) {
      reduced = result
    }
  }
  return reduced
}
