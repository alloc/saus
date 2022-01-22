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
  set(key: string, refreshDuration: number) {
    const ttl: TimeToLive = (ttlCache[key] = {
      expiresAt: Date.now() + refreshDuration,
      get isAlive() {
        if (key in ttlCache && ttl.expiresAt <= Date.now()) {
          delete ttlCache[key]
          return false
        }
        return true
      },
      keepAlive() {
        ttl.expiresAt = Date.now() + refreshDuration
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
