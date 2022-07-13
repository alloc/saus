import { route } from 'saus'
import { AssetStore, getPageFilename } from 'saus/core'

type PurgePayload = { paths: string[] }

export function addPurgeRoute(routePath: string, store: AssetStore) {
  route(routePath).post(async req => {
    const { paths } = await req.json<PurgePayload>()
    if (!Array.isArray(paths)) {
      return req.respondWith(400, {
        json: { error: 'Missing "paths" array parameter' },
      })
    }
    const deleting: Promise<void>[] = []
    for (const path of paths) {
      if (/\.(html|js)$/.test(path)) {
        deleting.push(store.delete(path))
      } else {
        const file = getPageFilename(path)
        for (const suffix of ['', '.js']) {
          deleting.push(store.delete(file + suffix))
        }
      }
    }
    await Promise.all(deleting)
    req.respondWith(200)
  })
}
