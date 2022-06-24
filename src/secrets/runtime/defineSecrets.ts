import { kSecretDefinition } from '../symbols'
import { DefinedSecrets, SecretMap } from '../types'

export function defineSecrets<T extends SecretMap>(def: T): DefinedSecrets<T> {
  return { [kSecretDefinition]: def } as any
}
