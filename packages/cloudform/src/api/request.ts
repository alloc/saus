import * as aws4 from 'aws4'
import * as qs from 'querystring'
import { getDeployContext } from 'saus/core'
import { http, HttpRequestOptions } from 'saus/http'
import { Actions } from './actions'

const region = 'us-east-1'

export type ActionParams<Action extends keyof Actions> = {
  Action: Action
  Version?: string
} & Actions[Action]['input']

/** Send a signed request to CloudFormation API */
export async function signedRequest<Action extends keyof Actions>(
  params: ActionParams<Action>,
  opts: Omit<HttpRequestOptions, 'body'> = {}
): Promise<Actions[Action]['output']> {
  const { secrets } = getDeployContext()
  const [accessKeyId, secretAccessKey] = await secrets.expect([
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
  ])

  opts.beforeSend = req => {
    const traceIdHeader = 'x-amzn-trace-id'
    const { [traceIdHeader]: traceId, ...signedHeaders } = req.headers || {}
    signedHeaders.accept = 'application/json'
    const signedReq = {
      protocol: req.protocol,
      method: req.method,
      path: req.path,
      headers: signedHeaders,
      service: 'cloudformation',
      region,
    }
    aws4.sign(signedReq, { accessKeyId, secretAccessKey })
    req.headers = signedReq.headers
    if (traceId) {
      req.headers[traceIdHeader] = traceId
    }
  }

  params.Version ||= '2010-05-15'
  const url =
    `https://cloudformation.${region}.amazonaws.com?` +
    qs.stringify(params as any)

  const res = await http('get', url, opts)
  return res.toJSON()
}
