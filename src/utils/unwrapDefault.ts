export function unwrapDefault<T = any>(module: { default: T }): T
export function unwrapDefault<T = any>(module: Promise<T>): never
export function unwrapDefault<T = any>(module: object): T
export function unwrapDefault<T = any>(module: any): T {
  const exported = Object.keys(module)
  if (exported.length == 1 && exported[0] == 'default') {
    return module.default
  }
  return module
}
