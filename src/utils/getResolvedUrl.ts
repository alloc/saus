import { relative } from 'path'

export function getResolvedUrl(root: string, resolvedId: string) {
  if (resolvedId[0] === '\0' || resolvedId.startsWith('/@fs/')) {
    return resolvedId
  }
  const relativeId = relative(root, resolvedId)
  if (!relativeId.startsWith('..')) {
    return '/' + relativeId
  }
  return '/@fs/' + resolvedId
}
