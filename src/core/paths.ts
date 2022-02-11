import path from 'path'

export const coreDir = toSausPath('src/core')
export const httpDir = toSausPath('src/http')
export const bundleDir = toSausPath('src/bundle')
export const clientDir = toSausPath('src/client')
export const runtimeDir = toSausPath('src/runtime')
export const globalCachePath = path.join(runtimeDir, 'cache.ts')

export function toSausPath(file: string) {
  return path.resolve(__dirname, '..', file)
}
