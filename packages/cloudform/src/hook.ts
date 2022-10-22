import { defineDeployHook } from 'saus/deploy'
import { describeStack } from './api/describeStack'
import { signedRequest } from './api/request'
import secrets from './secrets'
import { Stack } from './types'

export default defineDeployHook(ctx => ({
  name: '@saus/cloudform',
  async pull(stack: Stack) {
    const props = await describeStack(stack, {
      when: 'settled',
    })
    return {
      ...props,
      uri: stack.name + '-' + stack.region,
    }
  },
  ephemeral: ['uri'],
  identify: stack => ({
    name: stack.name,
    region: stack.region,
  }),
  spawn(stack, onRevert) {
    return ctx.logPlan(
      `create ${
        Object.keys(stack.template.resources).length
      } AWS resources for "${stack.uri}" stack`,
      async () => {
        const spawned = await spawnStack(
          stack,
          toTemplateString(stack.template)
        )
        stack.id = spawned.stackId
        Object.assign(
          stack,
          await describeStack(stack, {
            action: 'CREATE',
          })
        )
        onRevert(async () => {
          await this.kill(stack, onRevert)
        })
      }
    )
  },
  async update(stack, _, onRevert) {
    if (!stack.id) {
      throw Error('Expected stack.id to exist')
    }
    const prevTemplate = await getTemplate(stack)
    if (!prevTemplate) {
      throw Error(
        `Previous template not found for existing stack: ${stack.uri}`
      )
    }
    return ctx.logPlan(
      `update ${
        Object.keys(stack.template.resources).length
      } AWS resources for "${stack.uri}" stack`,
      async () => {
        await updateStack(stack, toTemplateString(stack.template))
        onRevert(() =>
          ctx.logPlan(`revert update for "${stack.uri}" stack`, () => {
            return updateStack(stack, prevTemplate)
          })
        )
      }
    )
  },
  async kill(stack) {
    const stackId = stack.id
    if (!stackId) {
      throw Error('Expected stack.id to exist')
    }
    return ctx.logPlan(
      `would destroy all ${
        Object.keys(stack.template.resources).length
      } AWS resources for "${stack.uri}" stack`,
      async () => {
        const deleteStack = signedRequest.action('DeleteStack', {
          creds: secrets,
          region: stack.region,
        })
        await deleteStack({
          stackName: stackId,
        })
        return () => {
          this.spawn(stack, () => {})
        }
      }
    )
  },
}))

async function spawnStack(stack: Stack, body: string) {
  const spawn = signedRequest.action('CreateStack', {
    creds: secrets,
    region: stack.region,
  })
  return spawn({
    stackName: stack.uri!,
    templateBody: body,
  })
}

async function updateStack(stack: Stack, body: string) {
  if (!stack.id) {
    throw Error('Expected stack.id to exist')
  }
  const updateStack = signedRequest.action('UpdateStack', {
    creds: secrets,
    region: stack.region,
  })
  await updateStack({
    stackName: stack.id,
    templateBody: body,
  }).catch(e => {
    if (/^No updates/.test(e.message)) {
      return // Everything is up-to-date!
    }
    throw e
  })
  Object.assign(
    stack,
    await describeStack(stack, {
      action: 'UPDATE',
    })
  )
}

async function getTemplate(stack: Stack) {
  const getTemplate = signedRequest.action('GetTemplate', {
    creds: secrets,
    region: stack.region,
  })
  const resp = await getTemplate({
    stackName: stack.id || stack.uri!,
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
