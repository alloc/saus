import { pick, pickAllExcept } from '../utils/pick'
import { commonParamKeys } from './params'

/**
 * Convert pascal-cased API params into HTTP headers. \
 * Unknown headers have `x-amz-` prepended to them.
 */
export function paramsToHeaders<Params extends object>(
  params: Params,
  ignore: (string & keyof Params)[] = []
): Http.RequestHeaders {
  return {
    ...pick(params, httpHeaderParams as any, Boolean),
    ...formatAmzHeaders(
      pickAllExcept(params, [
        ...ignore,
        ...commonParamKeys,
        ...httpHeaderParams,
      ])
    ),
  }
}

export function formatAmzHeaders(values: Record<string, any>) {
  return formatHeaders(values, key => 'x-amz-' + toDashCase(key))
}

export function formatHeaders(
  values: Record<string, any>,
  transformKey: (key: string) => string = toDashCase
) {
  const headers: Http.RequestHeaders = {}
  for (const key in values) {
    const value = values[key]
    if (value !== undefined) {
      headers[transformKey(key)] = value
    }
  }
  return headers
}

const toDashCase = (input: string) =>
  input
    .replace(/[a-z][A-Z]/g, ([prev, curr]) => prev + '-' + curr.toLowerCase())
    .toLowerCase()

const httpHeaderParams = [
  'CacheControl',
  'ContentDisposition',
  'ContentEncoding',
  'ContentLanguage',
  'ContentLength',
  'ContentMD5',
  'ContentType',
  'Expires',
] as const
