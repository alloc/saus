export function klona<T>(val: T, objects = new Map()): T {
  let out = objects.get(val)
  if (out) {
    return out
  }

  let k: any
  let tmp: any

  if (Array.isArray(val)) {
    out = Array((k = val.length))
    objects.set(val, out)
    while (k--) {
      out[k] =
        (tmp = val[k]) && typeof tmp === 'object' ? klona(tmp, objects) : tmp
    }
    return out
  }

  if (Object.prototype.toString.call(val) === '[object Object]') {
    out = {}
    objects.set(val, out)
    for (k in val) {
      if (k !== '__proto__') {
        out[k] =
          (tmp = val[k as keyof T]) && typeof tmp === 'object'
            ? klona(tmp, objects)
            : tmp
      }
    }
    return out
  }

  return val
}
