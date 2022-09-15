let throwOnMissingExport = 0

export function setThrowOnMissingExport(enabled: boolean) {
  throwOnMissingExport += enabled ? 1 : -1
}

export const exportNotFound = (file: string) =>
  new Proxy(Object.prototype, {
    get(_, key) {
      // Await syntax checks for "then" property to determine
      // if this is a promise.
      if (throwOnMissingExport > 0 && key !== 'then') {
        const err: any = Error(
          `The requested module '${file}' does not provide an export named '${
            key as string
          }'`
        )
        err.framesToPop = 1
        throw err
      }
    },
  })
