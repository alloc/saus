import { getDeployContext, SecretMap } from 'saus/core'

export function setUnsafeSecrets(secrets: SecretMap) {
  const { secretHub } = getDeployContext()
  secretHub.set(secrets)
}
