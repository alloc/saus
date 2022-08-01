// import { route } from 'saus'
// import { AssetStore, getPageFilename } from 'saus/core'
// import { PurgePlugin } from '@saus/purge'

// type PurgePayload = { paths: string[] }

// export function purgePageStore(store: AssetStore): PurgePlugin {
//   route(routePath).post(async req => {
//     const { paths } = await req.json<PurgePayload>()
//     if (!Array.isArray(paths)) {
//       return req.respondWith(400, {
//         json: { error: 'Missing "paths" array parameter' },
//       })
//     }
//     const deleting: any[] = []
//     for (const path of paths) {
//       if (/\.(html|js)$/.test(path)) {
//         deleting.push(store.delete(path))
//       } else {
//         const file = getPageFilename(path)
//         for (const suffix of ['', '.js']) {
//           deleting.push(store.delete(file + suffix))
//         }
//       }
//     }
//     await Promise.all(deleting)
//     req.respondWith(200)
//   })
// }
