import path from 'path'
import { vite } from '../core'
import { debug } from '../core/debug'

export function debugForbiddenImports(imports: string[]): vite.Plugin | false {
  if (!process.env.DEBUG) {
    return false
  }
  const sausRoot = path.resolve(__dirname, '..')
  return {
    name: 'debugForbiddenImports',
    enforce: 'pre',
    async resolveId(id, importer) {
      let absoluteId = id
      if (id[0] == '.') {
        const resolved = await this.resolve(id, importer, { skipSelf: true })
        absoluteId = resolved?.id.replace(sausRoot, '.')!
      }
      if (imports.includes(absoluteId)) {
        debug(`[!] Forbidden import "${id}" from "${importer}"`)
        return null
      }
    },
  }
}

export function debugSymlinkResolver(): vite.Plugin {
  return {
    name: 'debugSymlinkResolver',
    configResolved(config) {
      const { symlinkResolver } = config
      this.generateBundle = () => {
        console.log('cacheSize: %O', symlinkResolver.cacheSize)
        console.log('cacheHits: %O', symlinkResolver.cacheHits)
        console.log('fsCalls:   %O', symlinkResolver.fsCalls)
      }
    },
  }
}
