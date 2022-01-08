import { unwrapDefault } from './unwrapDefault'

export async function resolveModules<T extends Promise<any>[]>(
  ...modules: T
): Promise<T> {
  return (await Promise.all(modules)).map(unwrapDefault) as any
}
