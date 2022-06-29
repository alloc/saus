import { PartialDeep } from 'type-fest'
import { getDeployContext } from '../deploy'
import { deployedEnv, DeployedEnv } from './runtime/deployedEnv'

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
