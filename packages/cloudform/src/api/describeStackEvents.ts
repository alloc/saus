import secrets from '../secrets'
import { Stack } from '../types'
import { signedRequest } from './request'

export async function describeStackEvents(stack: Stack) {
  if (!stack.id) {
    throw Error('Expected stack.id to exist')
  }
  const getEvents = signedRequest.action('DescribeStackEvents', {
    region: stack.region,
    creds: secrets,
  })
  const { stackEvents } = await getEvents({
    stackName: stack.id,
  })
  return stackEvents || []
}
