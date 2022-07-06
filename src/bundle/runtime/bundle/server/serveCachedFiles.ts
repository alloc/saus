import { HttpRedirect } from '@/http/redirect'
import etag from 'etag'
import * as mime from 'mrmime'
import { connect } from './connect'
import type { FileCache } from './fileCache'

export const serveCachedFiles =
  (cache: FileCache): connect.Middleware =>
  (req, res, next) => {
    const entry =
      cache.get(req.url) ||
      cache.get(req.url.endsWith('/') ? req.url.slice(0, -1) : req.url + '/')

    if (entry == null) {
      return process.nextTick(next)
    }

    const [file, headers] = entry
    if (file instanceof HttpRedirect) {
      res.writeHead(301, {
        Location: file.location,
      })
    } else {
      res.writeHead(200, {
        ...(headers && headers()),
        'content-type': mime.lookup(req.url)!,
        etag: etag(typeof file !== 'string' ? Buffer.from(file) : file, {
          weak: true,
        }),
      })
      res.write(file)
    }
    res.end()
  }
