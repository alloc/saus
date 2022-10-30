import { Http } from 'saus/http'
import { rewriteObjectKeys } from 'saus/utils/keys'
import { camelize } from './utils'
import { xml } from './xml'
import { XmlParserOptions } from './xml/parse'

const xmlOptionsMap = new WeakMap<Http.Response, XmlParserOptions>()
const xmlParsedMap = new WeakMap<XmlParserOptions, any>()

export function cacheParsedXml(
  res: Http.Response,
  options: XmlParserOptions,
  data: any
) {
  xmlOptionsMap.set(res, options)
  xmlParsedMap.set(options, data)
}

export function parseXmlResponse(
  res: Http.Response,
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

export function normalizeObjectResponse(data: any, res: Http.Response) {
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
  _headers: Http.ResponseHeaders
}
