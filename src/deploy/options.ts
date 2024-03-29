import type { InlineBundleConfig } from '../bundle/context'

export type DeployCommand = 'deploy' | 'secrets'

export interface DeployOptions extends InlineBundleConfig {
  command?: DeployCommand
  /**
   * Deploy to a git respository other than `origin`.
   */
  gitRepo?: { name: string; url: string }
  /**
   * Kill all deployed targets.
   */
  killAll?: boolean
  /**
   * Skip the execution of any deployment action.
   */
  dryRun?: boolean
  /**
   * Avoid using cached build artifacts.
   *
   * For example, the `loadBundle` function respects this.
   */
  noCache?: boolean
  /**
   * Skip rollback functions on failure.
   */
  noRevert?: boolean
}
