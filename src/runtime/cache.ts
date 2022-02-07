import type { Cache } from '../core/withCache'

export const globalCache: Cache = {
  loading: {},
  loaders: {},
  loaded: {},
}
