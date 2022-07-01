import {} from 'type-fest'

export function assignDefaults<T, U extends Partial<T>>(
  target: T,
  defaults: U
): T & U

export function assignDefaults(target: any, defaults: any) {
  for (const key in defaults) {
    if (target[key] === undefined) {
      target[key] = defaults[key]
    }
  }
  return target
}
