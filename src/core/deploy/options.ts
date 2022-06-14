export type DeployCommand = 'deploy' | 'secrets'

export interface DeployOptions {
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
}
