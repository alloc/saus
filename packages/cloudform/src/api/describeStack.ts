import secrets from '../secrets'
import { Stack } from '../types'
import { signedRequest } from './request'

type StackOutputs = Record<string, string | undefined>

export interface DescribedStack {
  id?: string
  outputs?: StackOutputs
}

/** This only describes the first instance of the given stack. */
export async function describeStack(stack: Stack): Promise<DescribedStack> {
  const describeStacks = signedRequest.action('DescribeStacks', {
    creds: secrets,
    region: stack.region,
  })
  const { stacks } = await describeStacks({ stackName: stack.name }).catch(
    (e: any) => {
      if (!/ does not exist$/.test(e.message)) {
        throw e
      }
      return {} as ReturnType<typeof describeStacks>
    }
  )
  if (stacks?.length) {
    const { stackId, outputs = [] } = stacks[0]
    return {
      id: stackId!,
      outputs: outputs.reduce((outputs, { outputKey, outputValue }) => {
        if (outputKey) {
          outputs[outputKey] = outputValue
        }
        return outputs
      }, {} as StackOutputs),
    }
  }
  return {
    id: undefined,
    outputs: undefined,
  }
}
