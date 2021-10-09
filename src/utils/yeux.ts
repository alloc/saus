import { defer, Deferred } from './defer'

type PoolState = 0 | 1

const ACTIVE: PoolState = 0
const POOLED: PoolState = 1

export interface ObjectPool<T extends object> {
  pooled: readonly T[]
  get(): Promise<T>
  add(value: T): void
}

/** Create an object pool. */
export function yeux<T extends object>(
  create: () => T | Promise<T>,
  reset: (value: T) => void = () => {}
): ObjectPool<T> {
  const pooled: T[] = []
  const poolStates = new WeakMap<T, PoolState>()
  const requests: Deferred<T>[] = []

  return {
    pooled,
    async get() {
      let value = pooled.shift()
      if (value == null) {
        const newValue = create()
        if (newValue instanceof Promise) {
          const request = defer<T>()

          // If an old value is pooled before the new value
          // is ready, use that instead.
          requests.push(request)

          // Pool the new value if an old value became available
          // before this value was ready.
          newValue.then(newValue => {
            const index = requests.indexOf(request)
            if (index >= 0) {
              requests.splice(index, 1)
              request.resolve(newValue)
            } else {
              this.add(newValue)
            }
          })

          value = await request
        } else {
          value = newValue
        }
      }
      poolStates.set(value, ACTIVE)
      return value
    },
    add(value) {
      if (poolStates.get(value) !== POOLED) {
        reset(value)
        poolStates.set(value, POOLED)
        const get = requests.shift()
        if (get) {
          get.resolve(value)
        } else {
          pooled.push(value)
        }
      }
    },
  }
}
