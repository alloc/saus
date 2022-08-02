import { kSecretDefinition } from '../../secrets/symbols'
import { DefinedSecrets, SecretMap } from '../../secrets/types'

export function defineSecrets<T extends SecretMap>(def: T): DefinedSecrets<T> {
  return { [kSecretDefinition]: def } as any
}
