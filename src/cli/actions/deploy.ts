import { command } from '../command'

command(deploy)
  .option('-n, --dry-run', `[boolean] enable dry logs and skip deploying`)
  .option('--no-cache', `[boolean] avoid using cached build artifacts`)
  .option('--no-revert', `[boolean] skip rollbacks if deployment fails`)

export type DeployFlags = {
  dryRun?: true
  cache?: false
  revert?: false
}

export async function deploy(options: DeployFlags) {
  const { deploy } = await import('../../deploy/api')
  await deploy({
    ...options,
    noCache: options.cache === false,
    noRevert: options.revert === false,
  })
}
