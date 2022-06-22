import { Response, ResponseHeaders } from 'saus/http'
import { camelize, rewriteObjectKeys } from './utils'
import { xml } from './xml'
import { XmlParserOptions } from './xml/parse'

const xmlOptionsMap = new WeakMap<Response, XmlParserOptions>()
const xmlParsedMap = new WeakMap<XmlParserOptions, any>()

export function cacheParsedXml(
  res: Response,
  options: XmlParserOptions,
  data: any
) {
  xmlOptionsMap.set(res, options)
  xmlParsedMap.set(options, data)
}

export function parseXmlResponse(
  res: Response,
  options = xmlOptionsMap.get(res)
) {
  if (options) {
    const parsed = xmlParsedMap.get(options)
    if (parsed) {
      return parsed
    }
  }
  return xml.parse(res.data.toString(), options)
}

export function normalizeObjectResponse(data: any, res: Response) {
  data = rewriteObjectKeys(data, camelize)
  data._status = res.status
  data._headers = res.headers
  return data
}

export interface AmzError extends Error {
  code: string
  params: { Action: string } & Record<string, any>
  resource?: string
  requestId?: string
  _status: number
  _headers: ResponseHeaders
}
