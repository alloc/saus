import escalade from 'escalade/sync'
import { statSync } from 'fs'
import { dirname } from 'path'

export function findPackage(fromDir: string, tolerateMissingPaths?: boolean) {
  while (tolerateMissingPaths) {
    try {
      statSync(fromDir)
      break
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw e
      }
      fromDir = dirname(fromDir)
    }
  }
  return escalade(fromDir, (_parent, children) => {
    return children.find(name => name == 'package.json')
  }) as string | undefined
}
