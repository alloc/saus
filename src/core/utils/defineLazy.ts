export function defineLazy<T>(obj: T, props: { [P in keyof T]?: () => T[P] }) {
  for (const [key, get] of Object.entries<any>(props))
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get() {
        const value = get()
        Object.defineProperty(obj, key, {
          value,
          enumerable: true,
          configurable: true,
        })
        return value
      },
    })
}
