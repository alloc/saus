import { defineDeployHook } from 'saus/deploy'
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
  spawn(stack, onRevert) {
    return ctx.logPlan(
      `create ${
        Object.keys(stack.template.resources).length
      } AWS resources for "${stack.name}" stack`,
      async () => {
        const spawned = await spawnStack(
          stack,
          toTemplateString(stack.template)
        )
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
      }
    )
  },
  async update(stack, _, onRevert) {
    const stackId = stack.id
    if (!stackId) {
      throw Error('Expected stack.id to exist')
    }
    const prevTemplate = await getTemplate(stack)
    if (!prevTemplate) {
      throw Error(
        `Previous template not found for existing stack: ${stack.name}`
      )
    }
    return ctx.logPlan(
      `update ${
        Object.keys(stack.template.resources).length
      } AWS resources for "${stack.name}" stack`,
      async () => {
        const updateStack = signedRequest.action('UpdateStack', {
          creds: secrets,
          region: stack.region,
        })
        await updateStack({
          stackName: stackId,
          templateBody: toTemplateString(stack.template),
        }).catch(e => {
          if (/^No updates/.test(e.message)) {
            return // Everything is up-to-date!
          }
          throw e
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
      }
    )
  },
  async kill(stack) {
    const stackId = stack.id
    if (!stackId) {
      throw Error('Expected stack.id to exist')
    }
    return ctx.logPlan(
      `would destroy ${
        Object.keys(stack.template.resources).length
      } AWS resources`,
      async () => {
        ctx.logActivity(`Deleting the "${stack.name}" stack...`)
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
