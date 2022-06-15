import { defineDeployHook } from 'saus/core'
import { signedRequest } from './api/request'
import { Stack } from './types'

export default defineDeployHook(ctx => ({
  name: '@saus/cloudform',
  async pull(stack: Stack) {
    const { Stacks: [state] = [] } = await signedRequest({
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
      stack.name,
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
    const stackId = stack.id!
    const prevTemplate = await getTemplate(stackId)
    if (!prevTemplate) {
      throw Error(
        `Previous template not found for existing stack: ${stack.name}`
      )
    }
    await signedRequest({
      Action: 'UpdateStack',
      StackName: stackId,
      TemplateBody: JSON.stringify({
        Resources: stack.resources,
        Outputs: stack.outputs,
      }),
    })
    return async () => {
      const spawned = await spawnStack(stack.name, prevTemplate)
      stack.id = spawned.StackId
    }
  },
  async kill(stack) {
    const stackId = stack.id!
    await signedRequest({
      Action: 'DeleteStack',
      StackName: stackId,
    })
    return () => {
      this.spawn(stack)
    }
  },
}))

async function spawnStack(name: string, body: string) {
  return signedRequest({
    Action: 'CreateStack',
    StackName: name,
    TemplateBody: body,
  })
}

async function getTemplate(stackId: string) {
  const resp = await signedRequest({
    Action: 'GetTemplate',
    StackName: stackId,
  })
  return resp.TemplateBody
}
