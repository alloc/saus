import { bindExec } from '@saus/deploy-utils'
import path from 'path'
import { createCommit, relativeToCwd } from 'saus/core'
import { defineDeployHook } from 'saus/deploy'
import { PushConfig } from './config'
import { stashedRoots } from './stash'

export default defineDeployHook(ctx => {
  return {
    name: '@saus/git-push',
    ephemeral: ['repo', 'commit'],
    async pull(config: PushConfig) {
      const cwd = path.resolve(ctx.root, config.repo.root)
      const git = bindExec('git', { cwd })

      const { commit } = config
      if (commit === false) {
        ctx.logPlan(`skip commit in ${relativeToCwd(cwd)}/`)
      } else if (await git('status --porcelain')) {
        await ctx.logPlan(
          `commit changes in ${relativeToCwd(cwd)}/`,
          async () => {
            const message = commit?.message || ctx.lastCommitHeader
            await git('add -A')
            const commitResult = createCommit(message, { cwd })
            if (commitResult.success) {
              ctx.effective = true
            }
          }
        )
      }

      config.repo.head = await git('rev-parse HEAD')
      return {
        root: config.repo.root,
        head: config.repo.head,
      }
    },
    identify: ({ root }) => ({
      root,
    }),
    async spawn(config) {
      const cwd = path.resolve(ctx.root, config.root)
      const git = bindExec('git', { cwd })

      return ctx.logPlan(`push ${relativeToCwd(cwd)}/`, async () => {
        await git('push', stderr => {
          if (stderr == 'Everything up-to-date\n') {
            config.repo.pushed = true
          }
        })

        if (stashedRoots.has(cwd)) {
          await git('stash pop', { noThrow: true })
          stashedRoots.delete(cwd)
        }

        return async () => {
          await git('reset --hard HEAD^')
        }
      })
    },
    update(config, _, onRevert) {
      return this.spawn(config, onRevert)
    },
    kill: config => {
      // TODO: support kill action
    },
  }
})
