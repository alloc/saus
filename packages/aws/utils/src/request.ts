import * as aws4 from 'aws4'
import { getDeployContext } from 'saus/core'
import {
  Headers,
  http,
  HttpMethod,
  HttpRequestOptions,
  Response,
} from 'saus/http'
import { CamelCasedPropertiesDeep } from 'type-fest'
import { addXmlOptions, parseXmlResponse } from './response'
import { XmlParserOptions } from './xml/parse'

interface ActionMap {
  [name: string]: { params: object; result: any }
}

export interface AmzCredentials {
  accessKeyId: string
  secretAccessKey: string
}

export interface AmzRequestOptions extends HttpRequestOptions {
  method?: HttpMethod
  creds?: AmzCredentials
}

export interface AmzRequestOverrides {
  /** Set the default credentials. */
  creds?: AmzCredentials
  /** Override the default HTTP method. */
  method?: HttpMethod
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
    : never
) => AmzRequestOverrides

export type AmzCoerceResponseFn<
  Actions extends ActionMap,
  Action extends keyof Actions = keyof Actions
> = (
  resp: Response,
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
  acceptJson?: boolean
  listTags?: string[]
}

export interface AmzSendOptions<
  Actions extends ActionMap,
  Action extends string
> extends AmzRequestOptions {
  coerceRequest?: AmzCoerceRequestFn<Actions, Action>
  coerceResponse?: AmzCoerceResponseFn<Actions, Action>
}

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
        ? Response
        : T extends object
        ? CamelCasedPropertiesDeep<T> & { _status: number; _headers: Headers }
        : CamelCasedPropertiesDeep<T>
      : never
    : any

  /** Send a signed request to Amazon Web Services */
  async function send<Action extends string>(
    params: ActionParams<Action>,
    {
      method = 'get',
      creds,
      coerceRequest,
      coerceResponse,
      ...opts
    }: AmzSendOptions<Actions, Action> = {}
  ): Promise<ActionResult<Action>> {
    params.Version ||= config.apiVersion

    const subdomains = [config.service]
    if (config.region) {
      subdomains.push(config.region)
    }

    let path = ''
    let query: Record<string, any> | null = params
    let headers = opts.headers
    let body = opts.body
    let xmlOptions: XmlParserOptions | undefined

    if (coerceRequest) {
      const derived = coerceRequest(params as any)
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

    if (!creds) {
      const { secrets } = getDeployContext()
      creds = await secrets.expect({
        accessKeyId: 'AWS_ACCESS_KEY_ID',
        secretAccessKey: 'AWS_SECRET_ACCESS_KEY',
      })
    }

    opts.beforeSend = (req, body) => {
      const signedHeaders = req.headers
        ? omitKeys(req.headers, value => value == null)
        : {}
      const signedReq = {
        service: config.service,
        region: config.region,
        method: req.method!.toUpperCase(),
        host: req.hostname,
        path: req.path,
        headers: signedHeaders,
        // FIXME: The body shouldn't require UTF-8 encoding
        body: body && (body.text || body.buffer?.toString('utf8')),
      }
      if (!signedHeaders.accept && config.acceptJson) {
        signedHeaders.accept = 'application/json'
        coerceResponse ||= res => res.toJSON()
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
      allowBadStatus: true,
    })

    if (!res.ok) {
      console.error(
        `${params.Action} action ended with ${res.status} status code:`,
        res.data.toString('utf8')
      )
      throw res
    }

    if (res.headers['content-type'] == 'application/xml') {
      if (!coerceResponse) {
        return rewriteKeys(parseXmlResponse(res, xmlOptions), camelize)
      }
      if (xmlOptions) {
        addXmlOptions(res, xmlOptions)
      }
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
        coercedRes = rewriteObjectKeys(coercedRes, camelize)
        coercedRes._status = res.status
        coercedRes._headers = res.headers
      } else {
        coercedRes = rewriteKeys(coercedRes, camelize)
      }
      return coercedRes
    }
    return res as any
  }

  type ActionProps<Action extends string & keyof Actions> =
    CamelCasedPropertiesDeep<Omit<ActionParams<Action>, 'Action'>> &
      Pick<AmzRequestOptions, 'body' | 'creds' | 'headers'>

  send.action =
    <Action extends string & keyof Actions>(
      action: Action,
      opts: AmzSendOptions<Actions, Action> = {}
    ) =>
    ({ creds, body, headers, ...params }: ActionProps<Action>) => {
      const pascalParams: ActionParams<string & keyof Actions> =
        rewriteObjectKeys(params, pascalize)
      pascalParams.Action = action
      return send(pascalParams, {
        ...opts,
        body,
        creds,
        headers: headers ? { ...opts.headers, ...headers } : opts.headers,
      })
    }

  return send
}

// fooBar -> FooBar
function pascalize(key: string) {
  return key[0].toUpperCase() + key.slice(1)
}

// FooBar -> fooBar
function camelize(key: string) {
  return key.replace(/^([A-Z]+)([A-Z][a-z]|$)/, (_, k) => k.toLowerCase())
}

function rewriteKeys(value: any, rewriteKey: (key: string) => string): any {
  return Array.isArray(value)
    ? value.map(item => rewriteKeys(item, rewriteKey))
    : isObject(value)
    ? rewriteObjectKeys(value, rewriteKey)
    : value
}

function rewriteObjectKeys(props: any, rewriteKey: (key: string) => string) {
  const out: any = {}
  for (const [key, value] of Object.entries(props)) {
    const outKey = rewriteKey(key)
    out[outKey] = rewriteKeys(value, rewriteKey)
  }
  return out
}

function isObject(o: any): o is object {
  return !!o && typeof o == 'object' && !Array.isArray(o)
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

function omitKeys<T extends object, P extends keyof T>(
  obj: T,
  shouldOmit: (value: T[P], key: P) => boolean
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(prop => !shouldOmit(prop[1], prop[0] as P))
  ) as any
}
