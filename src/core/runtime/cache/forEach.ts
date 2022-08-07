import { Cache } from './types'

export async function forEach<State>(
  this: Cache<State>,
  onEntry: (key: string, entry: Cache.Entry<State>) => void,
  timeOutSecs?: number
): Promise<void> {
  const loaded = Object.entries(this.loaded)
  const loading = Object.entries(this.loading)
  for (const [key, entry] of loaded) {
    onEntry(key, entry)
  }
  await Promise.all(
    loading.map(async ([key, promise]) => {
      onEntry(key, await promise)
    })
  )
}
