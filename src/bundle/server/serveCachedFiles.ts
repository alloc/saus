import etag from 'etag'
import { gray } from 'kleur/colors'
import * as mime from 'mrmime'
import { HttpRedirect } from '../../http/redirect'
import { connect } from './connect'
import { debug } from './debug'
import { FileCache } from './fileCache'

export const serveCachedFiles =
  (cache: FileCache): connect.Middleware =>
  (req, res, next) => {
    const file =
      cache.get(req.url) ||
      cache.get(req.url.endsWith('/') ? req.url.slice(0, -1) : req.url + '/')

    if (file == null) {
      return process.nextTick(next)
    }

    debug(gray('cached'), req.url)
    if (file instanceof HttpRedirect) {
      res.writeHead(301, {
        Location: file.location,
      })
    } else {
      res.writeHead(200, {
        ETag: etag(typeof file !== 'string' ? Buffer.from(file) : file, {
          weak: true,
        }),
        'Content-Type': mime.lookup(req.url)!,
      })
      res.write(file)
    }
    res.end()
  }
