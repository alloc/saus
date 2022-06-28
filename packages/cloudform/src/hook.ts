import { createDryLog, defineDeployHook } from 'saus/deploy'
import { describeStack } from './api/describeStack'
import { signedRequest } from './api/request'
import secrets from './secrets'
import { Stack } from './types'

export default defineDeployHook(ctx => ({
  name: '@saus/cloudform',
  async pull(stack: Stack) {
    return describeStack(stack, {
      when: 'settled',
    })
  },
  identify: stack => ({
    name: stack.name,
  }),
  async spawn(stack, onRevert) {
    stack.outputs
    if (ctx.dryRun) {
      return createDryLog('@saus/cloudform')(
        `would create ${
          Object.keys(stack.template.resources).length
        } AWS resources`
      )
    }
    const spawned = await spawnStack(stack, toTemplateString(stack.template))
    onRevert(async () => {
      await this.kill(stack, onRevert)
    })
    stack.id = spawned.stackId
    Object.assign(
      stack,
      await describeStack(stack, {
        action: 'CREATE',
      })
    )
  },
  async update(stack, _, onRevert) {
    if (!stack.id) {
      throw Error('Expected stack.id to exist')
    }
    const prevTemplate = await getTemplate(stack)
    if (!prevTemplate) {
      throw Error(
        `Previous template not found for existing stack: ${stack.name}`
      )
    }
    if (ctx.dryRun) {
      return createDryLog('@saus/cloudform')(
        `would update ${
          Object.keys(stack.template.resources).length
        } AWS resources`
      )
    }
    const updateStack = signedRequest.action('UpdateStack', {
      creds: secrets,
      region: stack.region,
    })
    await updateStack({
      stackName: stack.id,
      templateBody: toTemplateString(stack.template),
    })
    onRevert(async () => {
      const spawned = await spawnStack(stack, prevTemplate)
      stack.id = spawned.stackId
    })
    Object.assign(
      stack,
      await describeStack(stack, {
        action: 'UPDATE',
      })
    )
  },
  async kill(stack) {
    if (!stack.id) {
      throw Error('Expected stack.id to exist')
    }
    if (ctx.dryRun) {
      return createDryLog('@saus/cloudform')(
        `would destroy ${
          Object.keys(stack.template.resources).length
        } AWS resources`
      )
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

function toTemplateString(template: Stack['template']) {
  return JSON.stringify({
    Resources: template.resources,
    Outputs: Object.entries(template.outputs).reduce((outputs, entry) => {
      if (entry[1] !== undefined) {
        outputs[entry[0]] = { Value: entry[1] }
      }
      return outputs
    }, {} as Record<string, any>),
  })
}
