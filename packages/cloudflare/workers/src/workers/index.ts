import { secrets } from '@saus/cloudflare-request'
import { addDeployHook, addDeployTarget, addSecrets } from 'saus/deploy'
import { Props } from './types'

addSecrets(uploadCloudflareWorkers, secrets)

const hook = addDeployHook(() => import('./hook'))

export function uploadCloudflareWorkers(props: Props) {
  return addDeployTarget(hook, props)
}
