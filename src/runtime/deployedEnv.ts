import { getRawGitHubUrl } from '@utils/node/getRawGitHubUrl'
import { JSONObject } from '@utils/types'
import { ReadonlyDeep } from 'type-fest'
import type { RuntimeConfig } from './config'
import { http } from './http'

export interface DeployedEnv {
  appVersion?: string
  githubToken?: string
  /** Used to encrypt/decrypt your project-specific secrets. */
  password?: string
  /**
   * The standard property for injecting the user-facing domain
   * into any plugin that wants it.
   */
  publicDomain?: string
}

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
export const deployedEnv: ReadonlyDeep<DeployedEnv> & JSONObject = {}

/**
 * Load the deployed environment from GitHub, if possible.
 *
 * The `deployedEnv.password` property is also set when
 * `process.env.PASSWORD` exists.
 */
export async function loadDeployedEnv(config: RuntimeConfig) {
  const env: any = deployedEnv
  if (config.githubRepo && config.githubToken) {
    const resp = await http(
      'get',
      getRawGitHubUrl({
        file: 'env.json',
        repo: config.githubRepo,
        branch: 'deployed',
        token: config.githubToken,
      })
    )

    Object.assign(env, resp.toJSON())
    env.githubToken = config.githubToken
  }
  if (process.env.PASSWORD) {
    env.password = process.env.PASSWORD
  }
}
