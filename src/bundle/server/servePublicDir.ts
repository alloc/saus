import etag from 'etag'
import fs from 'fs'
import { gray } from 'kleur/colors'
import * as mime from 'mrmime'
import path from 'path'
import runtimeConfig from '../runtimeConfig'
import { connect } from './connect'
import { debug } from './debug'

interface Options {
  /** @default runtimeConfig.publicDir */
  root?: string
  /**
   * When defined, only files matching this can be served
   * by this middleware.
   */
  include?: RegExp
  /**
   * When defined, files matching this cannot be served
   * by this middleware.
   */
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
  const cacheControl = resolveCacheControl(options)
  const {
    root: publicDir = runtimeConfig.publicDir,
    include = /./,
    ignore = /^$/,
  } = options

  return async function servePublicFile(req, res, next) {
    const fileName = req.url.slice(runtimeConfig.base.length)
    if (ignore.test(fileName) || !include.test(fileName)) {
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
