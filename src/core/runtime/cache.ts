import { randomUUID } from 'crypto'
import type { Cache } from './withCache'

console.log('LOAD GLOBAL CACHE')
export const globalCache: Cache = {
  id: randomUUID(),
  loading: {},
  loaders: {},
  loaded: {},
}
