import { deployedEnv } from '@/runtime/deployedEnv'
import type { SecretMap } from '../../secrets/types'

export function defineSecrets(secrets: SecretMap) {
  const keys: Record<string, string> = {}
  for (const key in secrets) {
    keys[secrets[key]] = key
  }
  // Secret access is forwarded to the deployedEnv object,
  // which should be populated by external packages.
  return new Proxy(deployedEnv, {
    get(_, key: string) {
      key = keys[key]
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
