type BranchProp<T> = keyof T extends infer Key
  ? Key extends string & keyof T
    ? T[Key] extends T | undefined
      ? Key
      : never
    : never
  : never

export function ascendBranch<T, U>(
  node: T | undefined,
  parentKey: BranchProp<T>,
  iterator: (node: T) => U
): U[] {
  const rets: U[] = []
  while (node) {
    rets.push(iterator(node))
    node = node[parentKey] as any
  }
  return rets
}
