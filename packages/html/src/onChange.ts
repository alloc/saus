type OnChange = (keyPath: string[], value: any, oldValue: any) => boolean | void

/**
 * Inspired by the `on-change` package, but much more limited.
 *
 * Symbol properties are ignored. Arrays are readonly. Complex objects
 * like Maps, Sets, and other `class` instances are not supported. Once
 * an object is observed, no other observers can ever be added.
 *
 * The change handler can return `false` to prevent the change.
 */
export function onChange<T>(target: T, handler: OnChange): T {
  return observe(target, [], handler)
}

/**
 * Get the target object of the given observer.
 */
onChange.target = <T>(observer: T): T => targetsByObserver.get(observer)!

const observersByTarget = new WeakMap<any, any>()
const targetsByObserver = new WeakMap<any, any>()

function observe(target: any, keyPath: string[], handler: OnChange) {
  if (!target || typeof target !== 'object') {
    return target
  }
  let observer = observersByTarget.get(target)
  if (!observer) {
    const typeName = Object.prototype.toString.call(target).slice(8, -1)
    if (typeName == 'Object') {
      observer = observeObject(target, keyPath, handler)
    } else if (typeName == 'Array') {
      observer = observeArray(target, keyPath, handler)
    } else {
      throw TypeError(`Unsupported object type: "${typeName}"`)
    }
    observersByTarget.set(target, observer)
    targetsByObserver.set(observer, target)
  }
  return observer
}

function observeArray(arr: any, keyPath: string[], handler: OnChange) {
  return new Proxy(arr, {
    get(obj, key) {
      if (typeof key !== 'string') {
        return Reflect.get(obj, key)
      }
      return observe(obj[key], keyPath.concat(key), handler)
    },
    set() {
      return false
    },
  })
}

function observeObject(obj: any, keyPath: string[], handler: OnChange) {
  return new Proxy(obj, {
    get(obj, key) {
      if (typeof key !== 'string') {
        return Reflect.get(obj, key)
      }
      return observe(obj[key], keyPath.concat(key), handler)
    },
    set(obj, key, value) {
      if (typeof key !== 'string') {
        return Reflect.set(obj, key, value)
      }
      if (handler(keyPath.concat(key), value, obj[key]) !== false) {
        obj[key] = value
      }
      return true
    },
  })
}
