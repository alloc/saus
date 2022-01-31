import type { vite } from '../core'

export function redirectModule(
  targetId: string,
  replacementId: string
): vite.Plugin {
  return {
    name: 'redirect-module:' + targetId,
    enforce: 'pre',
    async resolveId(id, importer) {
      if (importer && id[0] === '.' && targetId[0] === '/') {
        id = (await this.resolve(id, importer, { skipSelf: true }))?.id!
      }
      if (id === targetId) {
        return this.resolve(replacementId, importer, { skipSelf: true })
      }
    },
  }
}
