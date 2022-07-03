import fs from 'fs'

export function servedPathForFile(id: string, root: string, exists?: boolean) {
  if (id[0] === '\0' || id.startsWith('/@fs/')) {
    return id
  }
  if (id.startsWith(root + '/')) {
    return id.slice(root.length)
  }
  exists ??= fs.existsSync(id)
  return exists ? '/@fs/' + id : id
}
