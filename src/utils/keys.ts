export function omitKeys<T extends object, P extends keyof T>(
  obj: T,
  shouldOmit: (value: T[P], key: P) => boolean
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(prop => !shouldOmit(prop[1], prop[0] as P))
  ) as any
}

export function rewriteKeys(
  value: any,
  rewriteKey: (key: string) => string
): any {
  return Array.isArray(value)
    ? value.map(item => rewriteKeys(item, rewriteKey))
    : isObject(value)
    ? rewriteObjectKeys(value, rewriteKey)
    : value
}

export function rewriteObjectKeys(
  props: any,
  rewriteKey: (key: string) => string
) {
  const out: any = {}
  for (const [key, value] of Object.entries(props)) {
    const outKey = rewriteKey(key)
    out[outKey] = rewriteKeys(value, rewriteKey)
  }
  return out
}
