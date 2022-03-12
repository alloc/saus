import { join } from 'path'
import { bareImportRE } from '../utils/importRegex'
import { NodeResolveHook } from './hookNodeResolve'

export function dedupeNodeResolve(
  root: string,
  dedupe: string[]
): NodeResolveHook {
  const dedupeRE = new RegExp(`^(${dedupe.join('|')})($|/)`)
  const dedupeMap: Record<string, string | undefined> = {}

  root = join(root, 'stub.js')
  return (id, _importer, nodeResolve) => {
    if (bareImportRE.test(id) && dedupeRE.test(id)) {
      return (dedupeMap[id] ||= nodeResolve(id, root))
    }
  }
}
