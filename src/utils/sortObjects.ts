/**
 * Meant to be used with `JSON.stringify` to ensure that
 * object keys have a consistent order.
 */
export function sortObjects(_key: string, value: any) {
  if (value && value.constructor == Object) {
    const copy: any = {}
    for (const key of Object.keys(value).sort()) {
      copy[key] = value[key]
    }
    return copy
  }
  return value
}
