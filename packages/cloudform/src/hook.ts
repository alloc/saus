import { defineDeployHook } from 'saus/core'
import { signedRequest } from './api/request'
import { Stack } from './types'

export default defineDeployHook(ctx => ({
  name: '@saus/cloudform',
  async pull(stack: Stack) {
    const { Stacks: [state] = [] } = await signedRequest(stack.region)({
      Action: 'DescribeStacks',
      StackName: stack.name,
    })
    return {
      // The stack ID is required for updates and deletion.
      id: state?.StackId,
    }
  },
  identify: stack => ({
    name: stack.name,
  }),
  async spawn(stack) {
    const spawned = await spawnStack(
      stack,
      JSON.stringify({
        Resources: stack.resources,
        Outputs: stack.outputs,
      })
    )
    stack.id = spawned.StackId
    return async () => {
      await this.kill(stack)
    }
  },
  async update(stack) {
    if (!stack.id) {
      throw Error('Expected stack.id to exist')
    }
    const prevTemplate = await getTemplate(stack)
    if (!prevTemplate) {
      throw Error(
        `Previous template not found for existing stack: ${stack.name}`
      )
    }
    await signedRequest(stack.region)({
      Action: 'UpdateStack',
      StackName: stack.id,
      TemplateBody: JSON.stringify({
        Resources: stack.resources,
        Outputs: stack.outputs,
      }),
    })
    return async () => {
      const spawned = await spawnStack(stack, prevTemplate)
      stack.id = spawned.StackId
    }
  },
  async kill(stack) {
    if (!stack.id) {
      throw Error('Expected stack.id to exist')
    }
    await signedRequest(stack.region)({
      Action: 'DeleteStack',
      StackName: stack.id,
    })
    return () => {
      this.spawn(stack)
    }
  },
}))

async function spawnStack(stack: Stack, body: string) {
  return signedRequest(stack.region)({
    Action: 'CreateStack',
    StackName: stack.name,
    TemplateBody: body,
  })
}

async function getTemplate(stack: Stack) {
  const resp = await signedRequest(stack.region)({
    Action: 'GetTemplate',
    StackName: stack.id || stack.name,
  })
  return resp.TemplateBody
}
