import etag from 'etag'
import { gray } from 'kleur/colors'
import * as mime from 'mrmime'
import { connect } from './connect'
import { debug } from './debug'
import { ModuleCache } from './moduleCache'

export const serveClientModules =
  (moduleCache: ModuleCache): connect.Middleware =>
  (req, res, next) => {
    const module =
      moduleCache.get(req.url) ||
      moduleCache.get(
        req.url.endsWith('/') ? req.url.slice(0, -1) : req.url + '/'
      )

    if (!module) {
      return next()
    }

    debug(gray('cached'), req.url)
    res.writeHead(200, {
      ETag: etag(module.text, { weak: true }),
      'Content-Type': mime.lookup(module.id)!,
    })
    res.write(module.text)
    return res.end()
  }
