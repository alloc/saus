import { getDeployContext, SecretMap } from 'saus/core'

export function setUnsafeSecrets(values: SecretMap) {
  const { secrets } = getDeployContext()
  secrets.set(values)
}
