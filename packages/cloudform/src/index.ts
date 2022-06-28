import * as CloudForm from 'cloudform-types'
import { ResourceBase } from 'cloudform-types'
import {
  addDeployHook,
  addDeployTarget,
  addSecrets,
  getDeployContext,
} from 'saus/deploy'
import secrets from './secrets'
import { AttributeRef, ResourceRef, Stack, StackTemplate } from './types'

const hook = addDeployHook(() => import('./hook'))
addSecrets(useCloudFormation, secrets)

export type StackOptions<Outputs extends object | void = any> = {
  name: string
  region: string
  template: StackTemplate<Outputs>
}

/**
 * Declare a AWS CloudFormation stack.
 */
export function useCloudFormation<Outputs extends object | void>(
  options: StackOptions<Outputs>
): Promise<Stack<Outputs>> {
  return addDeployTarget<any, any>(hook, defineStack(options))
}

async function defineStack({ name, region, template }: StackOptions) {
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

  const { command } = getDeployContext()
  const outputs: any =
    command == 'deploy' ? await template(makeRef, CloudForm) : {}

  return {
    name,
    region,
    template: {
      resources,
      outputs,
    },
  }
}
