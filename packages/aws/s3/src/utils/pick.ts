export function pick<T extends object, P extends (keyof T)[]>(
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

export function pickAllExcept<T extends object, P extends (keyof T)[]>(
  obj: T,
  keys: P
): Pick<T, Exclude<keyof T, P[number]>>

export function pickAllExcept(
  obj: Record<string, any>,
  keys: string[]
): Record<string, any>

export function pickAllExcept(obj: any, keys: (keyof any)[]) {
  return pick(obj, Object.keys(obj) as any, (_, key) => !keys.includes(key))
}
