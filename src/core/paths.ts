import fs from 'fs'
import path from 'path'

// TODO: Ensure these paths are accurate.
export const bundleDir = toSausPath('bundle/runtime')
export const clientDir = toSausPath('client')
export const coreDir = toSausPath('core')
export const globalCachePath = toSausPath('runtime/cache.ts')
export const httpDir = toSausPath('runtime/http')
export const runtimeDir = toSausPath('runtime')
export const secretsDir = toSausPath('secrets')
export const utilsDir = toSausPath('utils')

export function toSausPath(file: string) {
  return fs.realpathSync(path.join(__dirname, file))
}
