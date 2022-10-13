import { deployedEnv, DeployedEnv } from '@runtime/deployedEnv'
import { PartialDeep } from 'type-fest'
import { getDeployContext } from '../deploy'

/**
 * Provide JSON values to the production SSR bundle
 * through the `deployedEnv` object.
 *
 * Call this during `saus deploy` only.
 */
export function setEnvData(env: PartialDeep<DeployedEnv>) {
  if (getDeployContext()) {
    Object.assign(deployedEnv, env)
  }
}
