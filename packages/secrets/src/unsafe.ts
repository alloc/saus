import { getDeployContext, SecretMap } from 'saus/deploy'

export function setUnsafeSecrets(values: SecretMap) {
  const { secrets } = getDeployContext()
  secrets.set(values)
}
