import { setThrowOnMissingExport } from '@/vite/exportNotFound'

/** Runtime `default` export unwrapping. */
export function __importDefault(exports: any) {
  if (exports && exports.__esModule) {
    return exports.default
  }
  return exports
}

/** Runtime `export *` emulation. */
export function __exportFrom(exports: any, imported: any[]) {
  return new Proxy(exports, {
    ownKeys() {
      const keys = new Set(Reflect.ownKeys(exports))
      imported.flatMap(Reflect.ownKeys).forEach(keys.add, keys)
      return Array.from(keys)
    },
    getOwnPropertyDescriptor() {
      // Ensure that `Object.keys` and `Object.entries` work,
      // since `import * as` will receive this proxy.
      return { enumerable: true, configurable: true, writable: true }
    },
    get(exports, key) {
      setThrowOnMissingExport(false)
      let value = exports[key]
      // NOTE: For simplicity's sake, we don't care about supporting the
      // ability to override a re-export with an undefined local export.
      if (value !== undefined) {
        setThrowOnMissingExport(true)
        return value
      }
      for (const exports of imported) {
        value = exports[key]
        if (value !== undefined) {
          setThrowOnMissingExport(true)
          return value
        }
      }
      setThrowOnMissingExport(true)
      exports[key] // This will throw if not re-exported.
    },
  })
}

/** Runtime `export let` emulation. */
export function __exportLet(exports: any, key: string, get: () => any) {
  Object.defineProperty(exports, key, {
    get,
    enumerable: true,
    configurable: true,
  })
}
