import { createCache } from './cache/create'

export const globalCache = createCache()

export type { CacheControl } from './cache/cacheControl'
export type { Cache } from './cache/types'
export { createCache }
