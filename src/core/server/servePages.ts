import getBody from 'raw-body'
import type { App } from '../../app/types'
import { parseUrl } from '../../utils/url'
import { makeRequestUrl } from '../endpoint'
import { connect } from './connect'
import { writeResponse } from './writeResponse'

interface RequestProps {
  app: App
}

export const servePages: connect.Middleware<RequestProps> =
  async function servePage(req, res, next) {
    const url = makeRequestUrl(
      parseUrl(req.url),
      req.method!,
      req.headers,
      () => getBody(req)
    )
    const [status, headers, body] = await req.app.callEndpoints(url)
    if (status == null) {
      return next()
    }
    writeResponse(res, status, headers, body)
  }
