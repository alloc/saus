import type { App } from '../../app/types'
import { makeRequestUrl } from '../../core/makeRequest'
import { writeResponse } from '../../runtime/writeResponse'
import { streamToBuffer } from '../../utils/streamToBuffer'
import { parseUrl } from '../../utils/url'
import { connect } from './connect'

interface RequestProps {
  app: App
}

export const servePages: connect.Middleware<RequestProps> =
  async function servePage(req, res, next) {
    const url = makeRequestUrl(
      parseUrl(req.url),
      req.method!,
      req.headers,
      () => streamToBuffer(req)
    )
    url.object = req
    const { status, headers, body } = await req.app.callEndpoints(url)
    if (status == null) {
      return next()
    }
    writeResponse(res, status, headers, body)
  }
