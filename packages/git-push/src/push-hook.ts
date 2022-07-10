import { bindExec } from '@saus/deploy-utils'
import path from 'path'
import { defineDeployHook } from 'saus/deploy'
import { PushConfig } from './config'

export default defineDeployHook(ctx => {
  return {
    name: '@saus/git-push',
    ephemeral: ['commit'],
    async pull(config: PushConfig) {
      const cwd = path.resolve(ctx.root, config.root)
      const git = bindExec('git', { cwd })

      if (config.commit !== false && !(await git('status --porcelain'))) {
        const message = config.commit?.message || ctx.lastCommitHeader
        await git('add -A')
        await git('commit -m', [message], {
          noThrow: true,
        })
      }

      return {
        head: await git('rev-parse HEAD'),
      }
    },
    identify: ({ root }) => ({
      root,
    }),
    async spawn(config) {
      const cwd = path.resolve(ctx.root, config.root)
      const git = bindExec('git', { cwd })

      await git('push')
    },
    update(config, _, onRevert) {
      return this.spawn(config, onRevert)
    },
    kill: config => {
      // TODO: support kill action
    },
  }
})
