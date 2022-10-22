import { defineDeployHook } from 'saus/deploy'
import { describeStack } from './api/describeStack'
import { describeStackEvents } from './api/describeStackEvents'
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
    region: stack.region,
  }),
  spawn(stack, onRevert) {
    return ctx
      .logPlan(
        `create ${
          Object.keys(stack.template.resources).length
        } AWS resources for "${stack.name}" stack`,
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
      .catch(async err => {
        if (err.code !== 'AlreadyExistsException') {
          throw err
        }
        // If spawning failed and a rollback was performed, the stack is
        // in a deleted state and needs to be explicitly deleted before
        // we can spawn it again.
        const [lastEvent] = await describeStackEvents(stack)
        if (lastEvent?.resourceStatus == 'ROLLBACK_COMPLETE') {
          await this.kill(stack, onRevert)
          await this.spawn(stack, onRevert)
        } else if (!lastEvent?.resourceStatus?.startsWith('DELETE_')) {
          // This happens when the deployment cache isn't aware that the
          // stack already exists. In this case, we can just update the
          // stack.
          await this.update!(stack, null!, onRevert)
        } else {
          throw err
        }
      })
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
    return ctx.logPlan(
      `update ${
        Object.keys(stack.template.resources).length
      } AWS resources for "${stack.name}" stack`,
      async () => {
        await updateStack(stack, toTemplateString(stack.template))
        onRevert(() =>
          ctx.logPlan(`revert update for "${stack.name}" stack`, () => {
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
      } AWS resources for "${stack.name}" stack`,
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
    stackName: stack.name,
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
