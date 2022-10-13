import { unwrapDefault } from './unwrapDefault'

export async function resolveModules<T extends Promise<any>[]>(
  ...modules: T
): Promise<{
  [Index in keyof T]: Awaited<T[Index]> extends infer Resolved
    ? Resolved extends { default: infer DefaultExport }
      ? DefaultExport
      : Resolved
    : never
}> {
  return (await Promise.all(modules)).map(unwrapDefault) as any
}
