import type { Cache } from './withCache'

export const globalCache: Cache = {
  loading: {},
  loaders: {},
  loaded: {},
}
