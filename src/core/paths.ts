import path from 'path'

export const coreDir = path.resolve(__dirname, '../src/core')
export const bundleDir = path.resolve(__dirname, '../src/bundle')
export const clientDir = path.resolve(__dirname, '../src/client')
export const runtimeDir = path.resolve(__dirname, '../src/runtime')
export const globalCachePath = path.join(runtimeDir, 'cache.ts')
