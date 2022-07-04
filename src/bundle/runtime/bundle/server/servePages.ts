import type { App } from '@/app'
import { makeRequestUrl } from '@/makeRequest'
import { parseUrl } from '@/node/url'
import { writeResponse } from '@/node/writeResponse'
import { streamToBuffer } from '@/utils/streamToBuffer'
import { connect } from './connect'

interface RequestProps {
  app: App
}

export const servePages: connect.Middleware<RequestProps> =
  async function servePage(req, res, next) {
    const url = makeRequestUrl(parseUrl(req.url), {
      object: req,
      method: req.method!,
      headers: req.headers,
      read: () => streamToBuffer(req),
    })
    const { status, headers, body } = await req.app.callEndpoints(url)
    if (status == null) {
      return next()
    }
    writeResponse(res, status, headers, body)
  }
