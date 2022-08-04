import { bindExec } from '@saus/deploy-utils'
import { existsSync } from 'fs'
import path from 'path'
import { relativeToCwd } from 'saus/core'
import { onDeploy } from 'saus/deploy'
import { GitRepository, InitConfig } from './config'
import { stashedRoots } from './stash'

/**
 * Call this before producing any build artifacts
 * so the local clone can be initialized and (most importantly)
 * synchronized with its remote repository.
 */
export function gitInit(config: InitConfig) {
  return onDeploy({
    name: '@saus/git-push',
    async run(ctx, onRevert): Promise<GitRepository> {
      const cwd = path.resolve(ctx.root, config.root)
      const git = bindExec('git', { cwd })

      // Sanity check to avoid data loss.
      if (cwd == ctx.root) {
        throw Error('@saus/git-push cannot be used on project root')
      }

      let { origin } = config
      if (typeof origin == 'string') {
        const [url, branch = 'master'] = origin.split('#')
        origin = { url, branch }
      }

      if (!ctx.dryRun) {
        if (existsSync(path.join(cwd, '.git'))) {
          if (await git('status --porcelain')) {
            if (config.hardReset) {
              await git('reset --hard')
              await git('clean -df')
            } else {
              await ctx.logPlan(
                `stash changes in ${relativeToCwd(cwd)}/`,
                async () => {
                  await git('reset')
                  await git('stash --include-untracked')
                  stashedRoots.add(cwd)
                  onRevert(async () => {
                    if (stashedRoots.has(cwd)) {
                      await git('stash pop', { noThrow: true })
                      stashedRoots.delete(cwd)
                    }
                  })
                }
              )
            }
          }
          await git('remote set-url origin', [origin.url])
        } else {
          await git('init')
          await git('remote add origin', [origin.url])
        }
        await git(`branch -u origin/${origin.branch}`)
        await git(`reset --hard origin/${origin.branch}`)
      }

      return {
        ...config,
        origin,
        head: '',
        pushed: false,
      }
    },
  })
}
