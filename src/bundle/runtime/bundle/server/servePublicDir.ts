import {
  ServePublicFileOptions,
  servePublicFile,
} from '@runtime/servePublicFile'
import etag from 'etag'
import { gray } from 'kleur/colors'
import runtimeConfig from '../config'
import { connect } from './connect'
import { debug } from './debug'

type Options = ServePublicFileOptions & {
  /**
   * Set the `max-age` Cache-Control directive. \
   * Set to `Infinity` to use the `immutable` directive.
   */
  maxAge?: number
  /** Use the `stale-while-revalidate` cache strategy */
  swr?: boolean | number
}

export function servePublicDir(options: Options = {}): connect.Middleware {
  const cacheControl = resolveCacheControl(options)

  return async function servePublicDir(req, res, next) {
    const file = servePublicFile(req.url, runtimeConfig, options)
    if (file) {
      debug(gray('read'), req.url)
      const entityTag = etag(file.data, { weak: true })
      if (req.headers['if-none-match'] == entityTag) {
        res.statusCode = 304
      } else {
        res.writeHead(200, {
          etag: entityTag,
          'content-type': file.mime,
          'cache-control': cacheControl,
        })
        res.write(file.data)
      }
      res.end()
    } else {
      next()
    }
  }
}

function resolveCacheControl(options: Options) {
  const cacheControl = ['public']
  if (options.maxAge !== undefined) {
    cacheControl.push(
      isFinite(options.maxAge) ? 'max-age=' + options.maxAge : 'immutable'
    )
  }
  if (options.swr !== undefined && options.swr !== false) {
    cacheControl.push(
      'stale-while-revalidate' +
        (typeof options.swr == 'number' ? '=' + options.swr : '')
    )
  }
  return cacheControl.join(', ')
}
