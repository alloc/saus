export function dset(obj: any, keys: string[], value: any) {
  for (const key of keys.slice(0, -1)) {
    obj[key] ??= {}
    obj = obj[key]
  }
  obj[keys[keys.length - 1]] = value
}
