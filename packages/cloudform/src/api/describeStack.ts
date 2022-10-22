import createDebug from 'debug'
import { dset } from 'dset'
import secrets from '../secrets'
import { Stack } from '../types'
import { describeStackEvents } from './describeStackEvents'
import { signedRequest } from './request'

export interface DescribedStack {
  id?: string
  outputs: Record<string, string | undefined>
}

interface DescribeOptions {
  /**
   * Wait for a specific action to complete.
   */
  action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK'
  /**
   * Wait until the current action is completed or failed.
   */
  when?: 'settled'
}

/** This only describes the first instance of the given stack. */
export async function describeStack(
  stack: Stack,
  opts: DescribeOptions = {},
  trace = Error()
): Promise<DescribedStack> {
  const describeStacks = signedRequest.action('DescribeStacks', {
    region: stack.region,
    creds: secrets,
  })
  const { stacks } = await describeStacks({ stackName: stack.uri! }).catch(
    (e: any) => {
      if (!/ does not exist$/.test(e.message)) {
        throw e
      }
      return {} as ReturnType<typeof describeStacks>
    }
  )
  if (stacks?.length) {
    const { stackId, outputs, stackStatus } = stacks[0]
    if (opts.action || opts.when == 'settled') {
      const action = opts.action || ''
      if (stackStatus.includes(action + '_IN_PROGRESS')) {
        return new Promise(resolve => {
          if (process.env.DEBUG) {
            logStackEvents(stack)
          }
          setTimeout(() => {
            resolve(describeStack(stack, opts, trace))
          }, 20e3)
        })
      }
      if (action && !stackStatus.includes(action + '_COMPLETE')) {
        await throwStackFailure({ ...stack, id: stackId }, trace)
      }
    }
    const outputPaths = Object.keys((stack as any)._outputs)
    return {
      id: stackId!,
      outputs: (outputs || []).reduce((outputs, { outputKey, outputValue }) => {
        if (outputKey) {
          const index = Number(outputKey)
          const outputPath = outputPaths[index].split('.')
          dset(outputs, outputPath, outputValue)
        }
        return outputs
      }, {} as Record<string, any>),
    }
  }
  return {
    id: undefined,
    outputs: {},
  }
}

const debug = createDebug('saus:cloudform')
const loggedEvents = new Set<string>()

async function logStackEvents(stack: Stack) {
  const events = await describeStackEvents(stack)
  for (const event of events) {
    if (event.resourceType == 'AWS::CloudFormation::Stack') {
      return // We've reached the previous stack update.
    }
    const status = event.resourceStatus
    if (!status || status.includes('ROLLBACK') || status.endsWith('_FAILED')) {
      continue
    }
    const log = `${status} ${event.stackName}::${
      event.logicalResourceId || event.resourceType
    }`
    if (!loggedEvents.has(log)) {
      debug(log)
      loggedEvents.add(log)
    }
  }
}

async function throwStackFailure(stack: Stack, trace: Error): Promise<void> {
  const events = await describeStackEvents(stack)
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    const status = event.resourceStatus
    if (!status || status.includes('ROLLBACK')) {
      continue
    }
    if (status.endsWith('_FAILED')) {
      const reason = event.resourceStatusReason || ''
      if (reason == 'Resource creation cancelled') {
        continue
      }

      const message = `Failed to ${status.slice(0, -7).toLowerCase()} "${
        event.logicalResourceId || event.resourceType
      }" resource. ${reason}`

      throw Object.assign(trace, {
        ...event,
        region: stack.region,
        code: status,
        message,
      })
    }
    if (event.resourceType == 'AWS::CloudFormation::Stack') {
      return // No failures found.
    }
  }
}
