/** Runtime `default` export unwrapping. */
export function __importDefault(exports: any) {
  if (exports && exports.__esModule) {
    return exports.default
  }
  return exports
}

/** Runtime `export *` emulation. */
export function __exportFrom(exports: any, imported: Record<string, any>) {
  for (const key in imported) {
    if (key !== 'default') {
      Object.defineProperty(exports, key, {
        enumerable: true,
        configurable: true,
        get() {
          return imported[key]
        },
      })
    }
  }
}

/** Runtime `export let` emulation. */
export function __exportLet(exports: any, key: string, get: () => any) {
  Object.defineProperty(exports, key, {
    get,
    enumerable: true,
    configurable: true,
  })
}
