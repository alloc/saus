import * as CloudForm from 'cloudform-types'
import { IntrinsicFunction, ResourceBase, Value } from 'cloudform-types'
import { Promisable } from 'type-fest'

export interface Stack {
  id?: string
  name: string
  region: string
  resources: Record<string, ResourceBase>
  outputs?: Record<string, Value<any>>
}

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
  get: <T = any>(attribute: Value<string>) => AttributeRef<T>
  dependsOn: (...resources: ResourceRef[]) => this
}

export namespace ResourceRef {
  export type Factory = (id: string, resource: ResourceBase) => ResourceRef
}
