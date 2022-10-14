import type { SecretMap } from '@/runtime/secrets/types'
import { deployedEnv } from '@runtime/deployedEnv'

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
