import type { ResolvedState } from '../runtime/stateModules'
import { unwrapDefault } from './unwrapDefault'

export async function resolveModules<T extends Promise<any>[]>(
  ...modules: T
): Promise<ResolvedState<T>> {
  return (await Promise.all(modules)).map(unwrapDefault) as any
}
