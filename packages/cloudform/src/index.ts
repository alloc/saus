import * as CloudForm from 'cloudform-types'
import {
  addDeployHook,
  addDeployTarget,
  addSecrets,
  getDeployContext,
} from 'saus/deploy'
import { isObject } from 'saus/utils/isObject'
import secrets from './secrets'
import {
  AttributeRef,
  ResourceBase,
  ResourceRef,
  Stack,
  StackTemplate,
} from './types'

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
) {
  return addDeployTarget(hook, defineStack(options)) as Promise<
    Required<Stack<Outputs>>
  >
}

const kRef = Symbol.for('cloudform.ref')

export function isResourceRef(obj: any): obj is ResourceRef {
  return !!obj && obj[kRef]
}

async function defineStack({ name, region, template }: StackOptions) {
  const resources: Record<string, ResourceBase> = {}
  const makeRef: ResourceRef.Factory = (id, resource) => {
    resources[id] = resource

    const ref: ResourceRef = CloudForm.Fn.Ref(id) as any
    ref.get = attr => CloudForm.Fn.GetAtt(id, attr) as AttributeRef

    const dependencies: any[] = []
    ref.dependsOn = (...deps) => {
      deps.forEach(dep => {
        dependencies.push(dep.id)
      })
      resource.dependsOn(dependencies)
      return ref
    }

    // Ignore these properties when diffing.
    return Object.defineProperties(ref, {
      [kRef]: { value: true },
      id: { value: id },
      get: { value: ref.get },
      dependsOn: { value: ref.dependsOn },
      properties: { value: resource },
    })
  }

  const { command } = getDeployContext()
  const outputs: any =
    command == 'deploy' ? toCfnOutputs(await template(makeRef, CloudForm)) : {}

  const stack: Stack = {
    name,
    region,
    template: {
      resources,
      // CloudFormation outputs must have alphanumeric keys and string values.
      // This plugin allows nested objects via dot-notated key paths.
      // Since dots are not allowed by CloudFormation, we have to use indices
      // to store the output values and convert them back to key paths later.
      outputs: Object.fromEntries(Object.entries(Object.values(outputs))),
    },
  }

  Object.defineProperty(stack, '_outputs', {
    value: outputs,
  })

  return stack
}

function toCfnOutputs(
  obj: Record<string, any>,
  out: Record<string, any> = {},
  path: string[] = []
) {
  for (let key in obj) {
    const value = obj[key]
    if (value && value.constructor == Object) {
      toCfnOutputs(value, out, path.concat(key))
    } else {
      key = path.concat(key).join('.')
      out[key] = isObject(value) ? value : '' + value
    }
  }
  return out
}
