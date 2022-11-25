import { sausRootDir } from '@/paths'
import path from 'path'
import { vite } from '../core'
import { debug } from '../debug'

export function debugForbiddenImports(imports: string[]): vite.Plugin | false {
  if (!process.env.DEBUG) {
    return false
  }
  return {
    name: 'debugForbiddenImports',
    enforce: 'pre',
    async redirectModule(id, importer) {
      if (!importer) return
      if (id.startsWith('/@fs/')) {
        id = id.slice(4)
      }
      const sausId = id.replace(sausRootDir, '.')
      if (sausId.startsWith('./') && imports.includes(sausId)) {
        id = path.relative(importer, id)
        debug(`[!] Forbidden import "${id}" from "${importer}"`)
        return null
      }
    },
  }
}

export function debugSymlinkResolver(): vite.Plugin {
  const self: vite.Plugin = {
    name: 'debugSymlinkResolver',
    configResolved(config) {
      const { symlinkResolver } = config
      self.generateBundle = () => {
        console.log('cacheSize: %O', symlinkResolver.cacheSize)
        console.log('cacheHits: %O', symlinkResolver.cacheHits)
        console.log('fsCalls:   %O', symlinkResolver.fsCalls)
      }
    },
  }
  return self
}
