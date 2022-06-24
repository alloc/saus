import { Promisable } from 'type-fest'
import { kSecretDefinition } from './symbols'

/** This can be extended by plugins via interface merging. */
export interface KnownSecrets {}

export type SecretMap = Record<string, any> & KnownSecrets

export interface SecretSource {
  name: string
  loaded?: Record<string, any>
  load: () => Promisable<Record<string, any>>
  set?: (secrets: SecretMap, replace?: boolean) => Promisable<void>
}

export interface MutableSecretSource extends SecretSource {
  set: (secrets: SecretMap, replace?: boolean) => Promisable<void>
}

export type DefinedSecrets<T extends SecretMap = any> = {
  [kSecretDefinition]: SecretMap
} & { [P in keyof T]: string }

export type { SecretHub } from './hub'
