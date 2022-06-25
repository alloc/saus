import { defineDeployHook } from 'saus/deploy'
import { signedRequest } from './api/request'
import secrets from './secrets'
import { Stack } from './types'

export default defineDeployHook(ctx => ({
  name: '@saus/cloudform',
  async pull(stack: Stack) {
    const describeStacks = signedRequest.action('DescribeStacks', {
      creds: secrets,
      region: stack.region,
    })
    const res = await describeStacks({ stackName: stack.name })
    return {
      // The stack ID is required for updates and deletion.
      id: res.stacks?.[0].stackId,
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
    stack.id = spawned.stackId
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
    const updateStack = signedRequest.action('UpdateStack', {
      creds: secrets,
      region: stack.region,
    })
    await updateStack({
      stackName: stack.id,
      templateBody: JSON.stringify({
        Resources: stack.resources,
        Outputs: stack.outputs,
      }),
    })
    return async () => {
      const spawned = await spawnStack(stack, prevTemplate)
      stack.id = spawned.stackId
    }
  },
  async kill(stack) {
    if (!stack.id) {
      throw Error('Expected stack.id to exist')
    }
    const deleteStack = signedRequest.action('DeleteStack', {
      creds: secrets,
      region: stack.region,
    })
    await deleteStack({
      stackName: stack.id,
    })
    return () => {
      this.spawn(stack)
    }
  },
}))

async function spawnStack(stack: Stack, body: string) {
  const spawn = signedRequest.action('CreateStack', {
    creds: secrets,
    region: stack.region,
  })
  return spawn({
    stackName: stack.name,
    templateBody: body,
  })
}

async function getTemplate(stack: Stack) {
  const getTemplate = signedRequest.action('GetTemplate', {
    creds: secrets,
    region: stack.region,
  })
  const resp = await getTemplate({
    stackName: stack.id || stack.name,
  })
  return resp.templateBody
}
