import etag from 'etag'
import { gray } from 'kleur/colors'
import * as mime from 'mrmime'
import { HttpRedirect } from '../../http/redirect'
import { textExtensions } from '../../utils/textExtensions'
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
      return next()
    }

    debug(gray('cached'), req.url)
    if (file instanceof HttpRedirect) {
      res.writeHead(301, {
        Location: file.location,
      })
    } else {
      res.writeHead(200, {
        ETag: etag(file, { weak: true }),
        'Content-Type': mime.lookup(req.url)!,
      })
      res.write(file)
    }
    return res.end()
  }
