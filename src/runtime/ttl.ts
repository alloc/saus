export type TimeToLive = {
  expiresAt: number
  isAlive: boolean
  keepAlive(): void
}

const ttlCache: Record<string, TimeToLive> = {}

export const TimeToLive = {
  get: Reflect.get.bind(Reflect, ttlCache) as (
    key: string
  ) => TimeToLive | undefined,
  /**
   * Set the time (in seconds) until the next access of the given `key` results
   * in a cache miss and clears the cached state.
   */
  set(key: string, maxAge: number) {
    const ttl: TimeToLive = (ttlCache[key] = {
      expiresAt: Date.now() + maxAge * 1e3,
      get isAlive() {
        if (key in ttlCache && ttl.expiresAt <= Date.now()) {
          delete ttlCache[key]
          return false
        }
        return true
      },
      keepAlive() {
        ttl.expiresAt = Date.now() + maxAge * 1e3
      },
    })
  },
  isAlive(key: string) {
    return ttlCache[key]?.isAlive !== false
  },
  keepAlive(key: string) {
    ttlCache[key]?.keepAlive()
  },
  delete(key: string) {
    delete ttlCache[key]
  },
}
