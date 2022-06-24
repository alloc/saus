export function dedupe<T, U = T>(
  arr: Iterable<T> | readonly T[],
  mapper?: (value: T, index: number) => U
): U[] {
  return Array.from(new Set(arr) as any, mapper!)
}
