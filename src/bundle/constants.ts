import path from 'path'

export const coreDir = path.resolve(__dirname, '../src/core')
export const runtimeDir = path.resolve(__dirname, '../src/bundle/runtime')
export const clientDir = path.resolve(__dirname, '../src/client')
export const clientCachePath = path.join(clientDir, 'cache.ts')
