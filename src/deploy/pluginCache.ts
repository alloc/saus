import { debug } from './debug'
export interface PluginCache<Entry, T extends { name: string }> {
  get: (entry: Entry, name?: string) => Promise<T | undefined>
  load: (entry: Entry, name?: string) => Promise<T>
}

export function createPluginCache<Entry, T extends { name: string }>(
  load: (entry: Entry) => Promise<T>
): PluginCache<Entry, T> {
  const plugins: Record<string, T> = {}
  const loadingEntries = new Map<Entry, Promise<T>>()
  const loadEntry = (entry: Entry) => {
    const promise = load(entry).then(plugin => {
      debug('loaded plugin:', plugin.name)
      plugins[plugin.name] = plugin
      loadingEntries.delete(entry)
      return plugin
    })
    loadingEntries.set(entry, promise)
    return promise
  }
  return {
    get: async (entry, name) =>
      (name && plugins[name]) || (await loadingEntries.get(entry)),
    load: async (entry, name) => (name && plugins[name]) || loadEntry(entry),
  }
}
