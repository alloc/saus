import { addDeployHook, addDeployTarget, addSecrets } from 'saus/deploy'
import { Config } from './config'
import secrets from './secrets'

const hook = addDeployHook(() => import('./hook.js'))
addSecrets(useCloudimage, secrets)

export function useCloudimage(config: Config) {
  return addDeployTarget(hook, config)
}
