import { globalCache } from '@/runtime/cache'

// This only exists to override the client implementation.
export const loadPageState = globalCache.get.bind(globalCache)
