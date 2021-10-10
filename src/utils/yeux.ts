import { defer, Deferred } from './defer'

type PoolState = 0 | 1

const ACTIVE: PoolState = 0
const POOLED: PoolState = 1

export interface ObjectPool<T extends object> {
  pooled: Promise<T[]>
  get(): Promise<T>
  add(value: T): void
}

interface Request<T extends object> extends Deferred<T> {
  newValue: Promise<T>
}

/** Create an object pool. */
export function yeux<T extends object>(
  create: () => T | Promise<T>,
  reset: (value: T) => void = () => {}
): ObjectPool<T> {
  const pooled: T[] = []
  const poolStates = new WeakMap<T, PoolState>()

  // Promises for get calls that will use a pooled
  // object when it becomes available.
  const requests: Request<T>[] = []

  // Promises for new objects that will be pooled
  // if not used before then.
  const surplus: Promise<T>[] = []

  return {
    get pooled(): Promise<T[]> {
      return Promise.all([...pooled, ...surplus])
    },
    async get() {
      let value = pooled.shift()
      if (value == null) {
        // If a previous get call resulted in a surplus,
        // use that instead of creating a new object.
        const pendingValue = surplus.shift()
        const newValue = pendingValue ? pendingValue : create()

        if (newValue instanceof Promise) {
          const request = defer() as Request<T>
          request.newValue = newValue

          // If an old value is pooled before the new value
          // is ready, use that instead.
          requests.push(request)

          // Pool the new value if an old value became available
          // before this value was ready.
          newValue.then(value => {
            let index = requests.indexOf(request)
            if (index >= 0) {
              requests.splice(index, 1)
              request.resolve(value)
            } else {
              // Pool the new object only if our promise is still
              // in the surplus, which means no other get call
              // has needed to use it.
              index = surplus.indexOf(newValue)
              if (index >= 0) {
                surplus.splice(index, 1)
                this.add(value)
              }
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
        poolStates.set(value, POOLED)
        reset(value)

        const get = requests.shift()
        if (get) {
          surplus.push(get.newValue)
          get.resolve(value)
        } else {
          pooled.push(value)
        }
      }
    },
  }
}
