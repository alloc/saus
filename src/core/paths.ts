import path from 'path'

// TODO: Ensure these paths are accurate.
export const bundleDir = toSausPath('src/bundle/runtime')
export const clientDir = toSausPath('src/core/client')
export const coreDir = toSausPath('src/core')
export const httpDir = toSausPath('src/core/http')
export const runtimeDir = toSausPath('src/core/runtime')
export const globalCachePath = path.join(runtimeDir, 'cache.ts')

export function toSausPath(file: string) {
  return path.resolve(__dirname, '..', file)
}
