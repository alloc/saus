import { NodeResolveHook } from './hookNodeResolve'

const bareImportRE = /^[\w@]/

export function dedupeNodeResolve(
  root: string,
  dedupe: string[]
): NodeResolveHook {
  const dedupeRE = new RegExp(`^(${dedupe.join('|')})($|/)`)
  const dedupeMap: Record<string, string | undefined> = {}

  return (id, _importer, nodeResolve) => {
    if (bareImportRE.test(id) && dedupeRE.test(id)) {
      return (dedupeMap[id] ||= nodeResolve(id, root))
    }
  }
}
