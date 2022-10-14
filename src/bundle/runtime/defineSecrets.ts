import { deployedEnv } from '@runtime/deployedEnv'
import type { SecretMap } from '../../secrets/types'

export function defineSecrets(secrets: SecretMap) {
  // Secret access is forwarded to the deployedEnv object,
  // which should be populated by external packages.
  return new Proxy(deployedEnv, {
    get(_, key: string) {
      key = secrets[key]
      if (key) {
        const value = deployedEnv[key]
        if (value === undefined) {
          throw Error('Missing secret: ' + key)
        }
        return value
      }
    },
  })
}
