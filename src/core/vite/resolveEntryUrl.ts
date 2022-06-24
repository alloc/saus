import type { vite } from '../vite'

const FS_PREFIX = /^\/@fs\/\/?/

export function resolveEntryUrl(id: string, config: vite.ResolvedConfig) {
  return FS_PREFIX.test(id)
    ? id.replace(FS_PREFIX, '/')
    : id[0] === '/'
    ? config.root + id
    : id
}
