import { Response } from 'saus/http'
import { xml } from './xml'
import { XmlParserOptions } from './xml/parse'

const xmlOptionsMap = new WeakMap<Response, XmlParserOptions>()

export function addXmlOptions(res: Response, options: XmlParserOptions) {
  xmlOptionsMap.set(res, options)
}

export function parseXmlResponse(
  res: Response,
  xmlOptions = xmlOptionsMap.get(res)
) {
  return xml.parse(res.data.toString(), xmlOptions)
}
