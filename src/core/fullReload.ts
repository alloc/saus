import { Module } from 'module'

/**
 * Create a `shouldReload` function that reloads almost every
 * SSR module, avoiding multiple instances of any one module.
 */
export function createFullReload(reloadList = new Set<string>()) {
  const loadedIds = Object.keys((Module as any)._cache)
  const skippedInternals = /\/saus\/(?!examples|packages)/

  return (id: string) => {
    // Module was possibly cached during the full reload.
    if (!loadedIds.includes(id)) {
      return false
    }
    // Modules are reloaded just once per full reload.
    if (reloadList.has(id)) {
      return false
    }
    // Internal modules should never be reloaded.
    if (skippedInternals.test(id)) {
      return false
    }
    reloadList.add(id)
    return true
  }
}
