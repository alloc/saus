import * as aws4 from 'aws4'
import { Agent } from 'https'
import { Headers, http, Http, HttpRequestOptions } from 'saus/http'
import { isObject } from 'saus/utils/isObject'
import { omitKeys, rewriteKeys, rewriteObjectKeys } from 'saus/utils/keys'
import { Promisable } from 'type-fest'
import {
  AmzError,
  cacheParsedXml,
  normalizeObjectResponse,
  parseXmlResponse,
} from './response'
import { CamelCasedPropertiesDeep } from './types'
import { camelize, pascalize } from './utils'
import { XmlParserOptions } from './xml/parse'

interface ActionMap {
  [name: string]: { params: object; result: any }
}

export interface AmzCredentials {
  accessKeyId: string
  secretAccessKey: string
}

export interface AmzRequestOptions extends HttpRequestOptions {
  /** AWS region */
  region?: string
  method?: Http.Method
  creds?: AmzCredentials
}

export interface AmzRequestOverrides {
  /** Set the default credentials. */
  creds?: AmzCredentials
  /** Override the default HTTP method. */
  method?: Http.Method
  /** Prepend a subdomain to the default hostname. */
  subdomain?: string
  /** Set the pathname of the URL. */
  path?: string
  /** Override the default querystring. Use null to omit it entirely. */
  query?: Record<string, any> | null
  /** Extra headers derived from API params. */
  headers?: Headers
  /** Override the request body. */
  body?: string | Buffer | NodeJS.ReadableStream
  /** Parse the XML response as a list. */
  xml?: XmlParserOptions
}

export type AmzCoerceRequestFn<
  Actions extends ActionMap,
  Action extends keyof Actions = keyof Actions
> = (
  params: Action extends keyof Actions
    ? Actions[Action]['params'] & { Action: Action; Version: string }
    : never,
  opts: HttpRequestOptions
) => Promisable<AmzRequestOverrides>

export type AmzCoerceResponseFn<
  Actions extends ActionMap,
  Action extends keyof Actions = keyof Actions
> = (
  resp: Http.Response,
  params: {
    Action: Action | keyof Actions
  } & (keyof Actions extends infer Action
    ? Action extends keyof Actions
      ? Actions[Action]['params'] & { Action: Action; Version: string }
      : never
    : never)
) => Actions[Action]['result']

interface AmzRequestConfig<Actions extends ActionMap> {
  region?: string
  service: string
  apiVersion: string
  /** Use the `Accept: application/json` request header by default */
  acceptJson?: boolean
  /** Omit the `region` from the subdomain */
  globalSubdomain?: boolean
}

export interface AmzSendOptions<
  Actions extends ActionMap,
  Action extends string
> extends AmzRequestOptions {
  coerceRequest?: AmzCoerceRequestFn<Actions, Action>
  coerceResponse?: AmzCoerceResponseFn<Actions, Action>
}

const agent = new Agent({ keepAlive: true })

export function createAmzRequestFn<Actions extends ActionMap>(
  config: AmzRequestConfig<Actions>
) {
  type ActionParams<Action> = {
    Action: Action | (string & keyof Actions)
    Version?: string
  } & (Action extends keyof Actions
    ? Actions[Action]['params']
    : Record<string, any>)

  type ActionResult<Action> = Action extends keyof Actions
    ? Actions[Action]['result'] extends infer T
      ? [T] extends [void]
        ? Http.Response
        : T extends object
        ? CamelCasedPropertiesDeep<T> & { _status: number; _headers: Headers }
        : T
      : never
    : any

  /** Send a signed request to Amazon Web Services */
  async function send<Action extends string>(
    params: ActionParams<Action>,
    {
      method = 'get',
      creds,
      region = config.region,
      coerceRequest,
      coerceResponse,
      ...opts
    }: AmzSendOptions<Actions, Action> = {}
  ): Promise<ActionResult<Action>> {
    const trace = new Error() as AmzError

    const subdomains = [config.service]
    if (region && !config.globalSubdomain) {
      subdomains.push(region)
    }

    let path = ''
    let query: Record<string, any> | null = params
    let headers = opts.headers
    let body = opts.body
    let xmlOptions: XmlParserOptions | undefined

    params.Version ||= config.apiVersion

    if (coerceRequest) {
      const derived = await coerceRequest(params as any, opts)
      if (derived.method) {
        method = derived.method
      }
      if (derived.headers) {
        headers = headers
          ? Object.assign(headers, derived.headers)
          : derived.headers
      }
      if (derived.path) {
        path = derived.path
        if (path[0] == '/') {
          path = path.slice(1)
        }
      }
      if (derived.query !== undefined) {
        query = derived.query
      }
      if (derived.subdomain) {
        subdomains.unshift(derived.subdomain)
      }
      if (derived.body !== undefined) {
        body = coerceBody(derived.body)
      }
      if (derived.xml) {
        xmlOptions = derived.xml
      }
      if (!creds && derived.creds) {
        creds = derived.creds
      }
    }

    opts.beforeSend = (req, body) => {
      const signedHeaders = req.headers
        ? omitKeys(req.headers, value => value == null)
        : {}
      const signedReq = {
        service: config.service,
        region,
        method: req.method!.toUpperCase(),
        host: req.hostname,
        path: req.path,
        headers: signedHeaders,
        // FIXME: The body shouldn't require UTF-8 encoding
        body: body && (body.text || body.buffer?.toString('utf8')),
      }
      if (!signedHeaders.accept && config.acceptJson) {
        signedHeaders.accept = 'application/json'
      }
      aws4.sign(signedReq, creds)
      req.headers = signedReq.headers
    }

    const url =
      `https://${subdomains.join('.')}.amazonaws.com/${path}` +
      formatQuery(query)

    const res = await http(method, url, {
      ...opts,
      headers,
      body,
      agent,
      allowBadStatus: true,
    })

    if (res.headers['content-type'] == 'application/xml') {
      const xmlRes = parseXmlResponse(res, (xmlOptions ||= {}))
      if (xmlRes.Error) {
        const props = { ...xmlRes.Error, params }
        Object.assign(trace, normalizeObjectResponse(props, res))
        throw trace
      }
      if (!coerceResponse) {
        return normalizeObjectResponse(xmlRes, res)
      }
      if (res.ok) {
        cacheParsedXml(res, xmlOptions, xmlRes)
      }
    } else if (!res.ok && res.headers['content-type'] == 'application/json') {
      const json = res.toJSON()
      if (json.Error) {
        const props = { ...json.Error, params }
        Object.assign(trace, normalizeObjectResponse(props, res))
        throw trace
      }
    }

    if (!res.ok) {
      Object.assign(trace, normalizeObjectResponse({ params }, res))
      trace.message = `${params.Action} action ended with ${res.status} status`
      throw trace
    }

    if (coerceResponse) {
      let coercedRes = coerceResponse(res, params as any)
      if (isObject(coercedRes)) {
        for (let [name, value] of Object.entries(res.headers)) {
          if (name.startsWith('x-amz-')) {
            name = coerceAmazonHeader(name)
            coercedRes[name] = value
          }
        }
        coercedRes = normalizeObjectResponse(coercedRes, res)
      } else {
        coercedRes = rewriteKeys(coercedRes, camelize)
      }
      return coercedRes
    }

    if (res.headers['content-type'] == 'application/json') {
      const json = res.toJSON()
      const responseKey = params.Action + 'Response'
      if (json[responseKey]) {
        const result = json[responseKey][params.Action + 'Result']
        if (isObject(result)) {
          return normalizeObjectResponse(result, res)
        }
        return result
      }
    }

    return res as any
  }

  type ActionProps<Action extends string & keyof Actions> =
    CamelCasedPropertiesDeep<Omit<ActionParams<Action>, 'Action'>> &
      Pick<AmzRequestOptions, 'body' | 'creds' | 'headers' | 'region'>

  send.action =
    <Action extends string & keyof Actions>(
      action: Action,
      opts: AmzSendOptions<Actions, Action> = {}
    ) =>
    ({
      body,
      headers,
      region = opts.region,
      creds = opts.creds,
      ...params
    }: ActionProps<Action>) => {
      const pascalParams: ActionParams<string & keyof Actions> =
        rewriteObjectKeys(params, pascalize)
      pascalParams.Action = action
      return send(pascalParams, {
        ...opts,
        body,
        creds,
        region,
        headers: headers ? { ...opts.headers, ...headers } : opts.headers,
      })
    }

  return send
}

function coerceAmazonHeader(name: string) {
  name = name.replace(/^x-amz-/, '')
  if (
    name !== 'server-side-encryption' &&
    (name = name.replace(/^server-side-/, 'SSE-')).startsWith('SSE-')
  ) {
    if (name == 'encryption-context') {
      name = 'KMSEncryptionContext'
    } else {
      name = name.replace(/^encryption-/, '')
      name = name.replace(/^aws-kms-/, 'KMS-')
    }
  } else {
    name = name.replace(
      /^(checksum-)(.+)/,
      (_, prefix, algo) => prefix + algo.toUpperCase()
    )
  }
  return name.replace(/(?:^|-)(.)/g, (_, ch) => ch.toUpperCase())
}

function coerceBody(body: string | Buffer | NodeJS.ReadableStream) {
  return typeof body == 'string'
    ? { text: body }
    : Buffer.isBuffer(body)
    ? { buffer: body }
    : { stream: body }
}

function formatQuery(obj: Record<string, any> | null) {
  if (!obj) {
    return ''
  }
  const entries = Object.entries(obj)
  if (!entries.length) {
    return ''
  }
  return (
    '?' +
    entries
      .reduce((parts, [key, value]) => {
        if (value != null) {
          parts.push(
            encodeURIComponent(key) +
              (value !== '' ? '=' + encodeURIComponent(value) : '')
          )
        }
        return parts
      }, [] as string[])
      .join('&')
  )
}
