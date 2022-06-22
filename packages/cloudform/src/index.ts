import * as CloudForm from 'cloudform-types'
import { ResourceBase } from 'cloudform-types'
import { addDeployHook, addDeployTarget, getDeployContext } from 'saus/core'
import { AttributeRef, ResourceRef, Stack, StackTemplate } from './types'

const hook = addDeployHook(() => import('./hook'))

export type StackOptions<Outputs extends object | void = any> = {
  name: string
  region: string
  template: StackTemplate<Outputs>
}

/**
 * Declare a AWS CloudFormation stack.
 */
export const useCloudFormation = <Outputs extends object | void>(
  options: StackOptions<Outputs>
): Promise<Stack<Outputs>> => addDeployTarget(hook, defineStack(options))

async function defineStack<Outputs extends object | void>({
  name,
  region,
  template,
}: StackOptions<Outputs>): Promise<Stack<Outputs>> {
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
  const outputs =
    command == 'deploy' ? await template(makeRef, CloudForm) : null

  return {
    name,
    region,
    resources,
    outputs,
  }
}
