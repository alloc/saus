type Promisable<T> = T | PromiseLike<T>

export async function mapSerial<T, U>(
  array: readonly T[],
  mapper: (element: T) => Promisable<U>
): Promise<U[]> {
  const mapped: U[] = []
  for (const element of array) {
    mapped.push(await mapper(element))
  }
  return mapped
}
