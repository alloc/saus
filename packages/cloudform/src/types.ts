import * as CloudForm from 'cloudform-types'
import { IntrinsicFunction, ResourceBase, Value } from 'cloudform-types'
import { Promisable } from 'type-fest'

export * from 'cloudform-types'

export interface Stack<Outputs extends object | void = any> {
  id?: string
  uri?: string
  name: string
  region: string
  template: {
    resources: Record<string, ResourceBase>
    outputs: Record<string, any>
  }
  outputs?: [Outputs] extends [Any]
    ? Record<string, string | undefined>
    : Outputs extends any
    ? undefined extends Outputs
      ? undefined
      : {
          [P in keyof Outputs]: ResolveOutputs<Outputs[P]>
        }
    : never
}

type ResolveOutputs<T> = T extends ResourceRef
  ? string
  : T extends AttributeRef<infer U>
  ? U
  : T extends object
  ? { [P in keyof T]: ResolveOutputs<T[P]> }
  : T

export type StackTemplate<Outputs extends object | void = void> = (
  ref: ResourceRef.Factory,
  aws: typeof CloudForm
) => Promisable<Outputs>

export interface AttributeRef<T = any> extends IntrinsicFunction {
  /** Not accessible from template function. */
  readonly result: T
}

export interface ResourceRef extends IntrinsicFunction {
  readonly id: string
  readonly properties: any
  get: <T = any>(attribute: Value<string>) => AttributeRef<T>
  dependsOn: (...resources: ResourceRef[]) => this
}

export namespace ResourceRef {
  export type Factory = (id: string, resource: ResourceBase) => ResourceRef
}

// Helper class type for `any` detection
declare class Any {
  private _: any
}
