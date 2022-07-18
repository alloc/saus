import { defineRoutePlugin } from '@/runtime/routePlugins'
import etag from 'etag'
import * as mime from 'mrmime'
import { loadAsset, loadModule } from '../runtime/bundle/clientStore'

type Params = { wild: string }

export default defineRoutePlugin<never, Params>(config => router => {
  router.get(async req => {
    try {
      const id = req.wild
      if (id.endsWith('.js')) {
        const text = await loadModule(id)
        req.respondWith(200, {
          text,
          headers: {
            'content-type': 'text/javascript',
            etag: etag(text, { weak: true }),
          },
        })
      } else {
        const buffer = await loadAsset(req.path.slice(1))
        req.respondWith(200, {
          buffer,
          headers: {
            'content-type': mime.lookup(id)!,
            etag: etag(buffer, { weak: true }),
          },
        })
      }
    } catch {}
  })
})
