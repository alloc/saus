export function pick<T, P extends (keyof T)[]>(
  obj: T,
  keys: P,
  filter: (value: any, key: P[number]) => boolean = () => true
): Pick<T, P[number]> {
  const picked: any = {}
  for (const key of keys) {
    const value = obj[key]
    if (filter(value, key)) {
      picked[key] = value
    }
  }
  return picked
}

export function pickAllExcept<T, P extends (keyof T)[]>(obj: T, keys: P) {
  return pick(obj, Object.keys(obj) as any, (_, key) => !keys.includes(key))
}
