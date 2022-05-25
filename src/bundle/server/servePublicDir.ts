import etag from 'etag'
import fs from 'fs'
import { gray } from 'kleur/colors'
import * as mime from 'mrmime'
import path from 'path'
import runtimeConfig from '../core/runtimeConfig'
import { connect } from './connect'
import { debug } from './debug'

interface Options {
  /** @default runtimeConfig.publicDir */
  root?: string
  /** Prevent certain files from being served */
  ignore?: RegExp
  /**
   * Set the `max-age` Cache-Control directive. \
   * Set to `Infinity` to use the `immutable` directive.
   */
  maxAge?: number
  /** Use the `stale-while-revalidate` cache strategy */
  swr?: boolean | number
}

export function servePublicDir(options: Options = {}): connect.Middleware {
  const { root: publicDir = runtimeConfig.publicDir, ignore = /^$/ } = options
  const cacheControl = resolveCacheControl(options)

  return async function servePublicFile(req, res, next) {
    const fileName = req.url.slice(runtimeConfig.base.length)
    if (ignore.test(fileName)) {
      return next()
    }
    try {
      const content = fs.readFileSync(path.join(publicDir, fileName))
      debug(gray('read'), req.url)
      res.writeHead(200, {
        ETag: etag(content, { weak: true }),
        'Content-Type': mime.lookup(req.url) || 'application/octet-stream',
        'Cache-Control': cacheControl,
      })
      res.write(content)
      res.end()
    } catch (e: any) {
      if (e.code == 'ENOENT') {
        return next()
      }
      throw e
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
