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

export function isObject(o: any): o is object {
  return !!o && typeof o == 'object' && !Array.isArray(o)
}
