import { http } from '../http'
import type { RuntimeConfig } from './config'
import { getRawGitHubUrl } from './git'

export interface DeployedEnv extends Record<string, string> {}

/**
 * Environment variables and possibly some secrets loaded
 * securely at runtime by a package like `@saus/secrets`.
 *
 * This is populated in production only.
 *
 * Deployment plugins can mutate this and its values will
 * be available in production. **But never add secrets**
 * to this object during deployment! You can use `@saus/secrets`
 * instead.
 */
export const deployedEnv: DeployedEnv = {}

export async function loadDeployedEnv(config: RuntimeConfig) {
  if (config.githubToken) {
    const resp = await http(
      'get',
      getRawGitHubUrl({
        file: 'env.json',
        repo: config.githubRepo,
        branch: 'deployed',
        token: config.githubToken,
      })
    )

    Object.assign(deployedEnv, resp.toJSON())
  }
}
