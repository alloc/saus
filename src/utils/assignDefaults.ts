export function assignDefaults<T>(target: T, defaults: Partial<T>): T {
  for (const key in defaults) {
    if (target[key] === undefined) {
      // @ts-ignore
      target[key] = defaults[key]
    }
  }
  return target
}
