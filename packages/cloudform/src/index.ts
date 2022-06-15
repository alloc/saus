import * as CloudForm from 'cloudform-types'
import { ResourceBase } from 'cloudform-types'
import { addDeployTarget, DeployHook } from 'saus/core'
import { signedRequest } from './api/request'
import { AttributeRef, ResourceRef, Stack, StackTemplate } from './types'

/**
 * Declare a AWS CloudFormation stack.
 */
export function useCloudFormation(name: string, template: StackTemplate) {
  addDeployTarget(deploy, defineStack(name, template))
}

async function defineStack(
  name: string,
  template: StackTemplate<any>
): Promise<Stack> {
  const { Stacks: [stack] = [] } = await signedRequest({
    Action: 'DescribeStacks',
    StackName: name,
  })

  // The stack ID is required for updates and deletion.
  const stackId = stack?.StackId

  const resources: Record<string, ResourceBase> = {}
  const makeRef: ResourceRef.Factory = (id, resource) => {
    resources[id] = resource

    const ref: ResourceRef = CloudForm.Fn.Ref(id) as any
    ref.get = attr => CloudForm.Fn.GetAtt(id, attr) as AttributeRef
    ref.dependsOn = (...deps) => {
      deps.forEach(dep => resource.dependsOn(dep.id))
      return ref
    }

    // Ignore these properties when diffing.
    return Object.defineProperties(ref, {
      id: { value: id },
      get: { value: ref.get },
      dependsOn: { value: ref.dependsOn },
    })
  }
  const outputs = await template(makeRef, CloudForm)
  return {
    id: stackId,
    name,
    resources,
    outputs,
  }
}

async function spawnCloudFormationStack(name: string, body: string) {
  return signedRequest({
    Action: 'CreateStack',
    StackName: name,
    TemplateBody: body,
  })
}

const deploy: DeployHook<Stack> = ctx => ({
  name: '@saus/cloudform',
  identify: target => ({ name: target.name }),
  async spawn(stack) {
    const spawned = await spawnCloudFormationStack(
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
      const spawned = await spawnCloudFormationStack(stack.name, prevTemplate)
      stack.id = spawned.StackId
    }
  },
  async kill(stack) {
    const stackId = stack.id!
    await signedRequest({
      Action: 'DeleteStack',
      StackName: stackId,
    })
  },
})

async function getTemplate(stackId: string) {
  const resp = await signedRequest({
    Action: 'GetTemplate',
    StackName: stackId,
  })
  return resp.TemplateBody
}
