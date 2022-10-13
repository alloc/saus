import { Endpoint } from '@runtime/endpoint'
import { defineRoutePlugin } from '@runtime/routePlugins'
import etag from 'etag'
import * as mime from 'mrmime'
import { loadAsset, loadModule } from '../runtime/bundle/clientStore'

type Params = { wild: string }

export default defineRoutePlugin<never, Params>(config => router => {
  router.get(async req => {
    if (req.headers.accept?.includes('text/html')) {
      return
    }
    const id = req.wild
    try {
      let body: Endpoint.AnyBody
      if (id.endsWith('.js')) {
        body = {
          text: await loadModule(id),
        }
      } else {
        body = {
          buffer: await loadAsset(id),
        }
      }
      req.respondWith(200, {
        ...body,
        headers: {
          'content-type': mime.lookup(id)!,
          etag: etag((body.buffer as any) || body.text!, { weak: true }),
        },
      })
    } catch {}
  })
})
