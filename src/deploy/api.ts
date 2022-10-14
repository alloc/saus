import exec from '@cush/exec'
import { defer, Deferred } from '@utils/defer'
import { diffObjects } from '@utils/diffObjects'
import { noop } from '@utils/noop'
import { plural } from '@utils/plural'
import { Promisable } from '@utils/types'
import { addExitCallback, removeExitCallback } from 'catch-exit'
import fs from 'fs'
import { bold, cyan, gray, green, red, yellow } from 'kleur/colors'
import { success } from 'misty'
import { startTask } from 'misty/task'
import path from 'path'
import yaml from 'yaml'
import { createCommit, vite } from '../core'
import { loadDeployContext } from './context'
import { loadDeployFile } from './loader'
import { setLogFunctions } from './logger'
import { DeployOptions } from './options'
import {
  getMissingTargets,
  getSavedTargets,
  markTargetReused,
  refreshTargetCache,
  saveTargetCache,
} from './targetCache'
import {
  DeployFile,
  DeployHookRef,
  DeployPlugin,
  DeployTarget,
  RevertFn,
} from './types'
import { defineTargetId, omitEphemeral } from './utils'

export { DeployOptions }

/**
 * Identical to running `saus deploy` from the terminal.
 */
export async function deploy(
  options: DeployOptions = {},
  inlineConfig: vite.UserConfig = {}
) {
  const ctx = await loadDeployContext(options, inlineConfig)

  let gitStatus = await exec('git status --porcelain', { cwd: ctx.root })
  if (!options.dryRun && gitStatus) {
    throw Error('[saus] Cannot deploy with uncommitted changes')
  }

  const { files, logger } = ctx

  const deployLockfile = files.get('deploy.lock')
  if (!options.dryRun && deployLockfile.exists) {
    throw Error('[saus] A deployment is already in progress')
  }

  // Prevent parallel runs of `saus deploy`.
  deployLockfile.setBuffer(Buffer.alloc(1))

  let task = logger.isLogged('info')
    ? startTask('Preparing to deploy...')
    : null

  await ctx.syncDeployCache()

  let lastError: any
  const logError = (e: any) => {
    if (e !== lastError && e.message !== lastError?.message) {
      if (e.message.startsWith('[saus]')) {
        logger.error('\n' + red('✗') + e.message.slice(6))
      } else {
        logger.error(e, { error: e })
      }
    }
    lastError = e
  }

  addExitCallback((_signal, _exitCode, error) => {
    if (error) {
      logError(error)
      process.exit(1)
    }
  })

  const revertiblePlugins = new Set<DeployPlugin>()
  const addRevertFn = (
    revert: RevertFn | void,
    plugin?: DeployPlugin,
    action?: string
  ) => {
    if (typeof revert == 'function') {
      ctx.revertFns.push(revert)
      if (plugin && !options.dryRun) {
        revertiblePlugins.add(plugin)
      }
    } else if (plugin && !options.dryRun && !revertiblePlugins.has(plugin)) {
      logger.warnOnce(
        yellow(
          `Beware: Plugin "${plugin.name}" did not return a rollback function ` +
            `for its "${action}" action. If an error happens while deploying, its ` +
            `effects won't be automatically reversible!`
        )
      )
    }
  }

  const invokeAction = async <Action extends 'spawn' | 'update' | 'kill'>(
    plugin: DeployPlugin,
    action: Action,
    ...args: DeployPlugin[Action] extends (
      ...args: [...infer Args, (fn: RevertFn) => void]
    ) => any
      ? Args
      : any[]
  ) => {
    const actionFn = plugin[action]
    if (actionFn) {
      const actionArgs = args.concat((fn: RevertFn) => {
        addRevertFn(fn, plugin, action)
      })
      const revertFn = await (actionFn as Function).apply(plugin, actionArgs)
      addRevertFn(revertFn, plugin, action)
    }
  }

  // This is defined after the `loadDeployFile` promise is resolved.
  // Until then, we assume a new target may be added at some point.
  let deploying: Deferred<void> | undefined
  let activePlugin: DeployPlugin = null!

  const savedTargets = getSavedTargets()
  const updatedTargets = new Set<DeployTarget>()
  const spawnedTargets = new Set<DeployTarget>()

  /** Queued targets before this index are done deploying. */
  let targetIndex = 0

  const deployTarget = async (
    hook: DeployHookRef,
    target: Promisable<DeployTarget>
  ) => {
    const index = targetIndex
    const plugin = (activePlugin = hook.plugin!)
    deploy: try {
      target = await target
      if (plugin.pull) {
        const pulled = await plugin.pull(target)
        if (pulled) {
          Object.assign(target, pulled)
        }
      }

      defineTargetId(target, await plugin.identify(target))

      let changed: Record<string, any> | undefined
      const changedPaths = process.env.DEBUG ? new Set<string>() : undefined!

      const savedTarget = await savedTargets.match(target, plugin)
      if (savedTarget) {
        const cmp = diffObjects(
          savedTarget,
          omitEphemeral(target, plugin),
          (changed = {}),
          changedPaths
        )
        if (!cmp) {
          markTargetReused(savedTarget, savedTargets)
          break deploy // Nothing changed.
        }
      }

      if (changedPaths) {
        logger.info(
          `\n` +
            yellow(bold(`Target was changed!\n`)) +
            `Properties of ${cyan(plugin.name)}${gray(
              '/' + target._id.hash
            )} were changed:\n  ${Array.from(changedPaths)
              .map(m => '.' + m)
              .join('\n  ')}` +
            `\n`
        )
      }

      if (savedTarget) {
        if (plugin.update) {
          await invokeAction(plugin, 'update', target, changed!)
        } else {
          await invokeAction(plugin, 'kill', target)
          await invokeAction(plugin, 'spawn', target)
        }
        updatedTargets.add(target)
        markTargetReused(savedTarget, savedTargets)
      } else {
        await invokeAction(plugin, 'spawn', target)
        spawnedTargets.add(target)
      }
    } catch (e: any) {
      return (deploying || Promise).reject(e)
    } finally {
      activePlugin = null!
    }

    if (index == targetIndex) {
      if (++targetIndex < ctx.targets.length) {
        queueMicrotask(() => {
          const [hook, target, resolve] = ctx.targets[targetIndex]
          const promise = deployTarget(hook, target)
          promise.catch(noop)
          resolve(promise)
        })
      } else {
        deploying?.resolve()
      }
    }
    return target
  }

  let newTargetCache: DeployFile | undefined
  let deployFailed = false

  const onCrash = addExitCallback((_signal, _code, error) => {
    if (!deployFailed && error)
      logger.warn(
        '\n' +
          yellow(
            (activePlugin ? `Plugin "${activePlugin.name}"` : `Something`) +
              ` crashed the process and so any changes made before then` +
              ` could not be rolled back!`
          )
      )
  })

  let preDeploySetupPromise: Promise<any> | undefined
  const preDeploySetup = () => {
    if (!preDeploySetupPromise) {
      preDeploySetupPromise = (async () => {
        const missing = await ctx.secrets.load()
        if (missing) {
          throw Error(
            '[saus] Secrets are missing:\n' +
              Array.from(missing, name => `  - ` + name).join('\n')
          )
        }
        await Promise.all(
          ctx.deployHooks.map(hookRef => {
            return ctx.deployPlugins.load(hookRef)
          })
        )
      })()

      // Avoid unhandled rejection crash.
      preDeploySetupPromise.catch(noop)
    }
    return preDeploySetupPromise
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  ctx.addDeployTarget = async (...args) => {
    await preDeploySetup()
    const index = ctx.targets.push(args) - 1
    if (index == targetIndex) {
      const [hook, target, resolve] = args
      const promise = deployTarget(hook, target)
      promise.catch(noop)
      resolve(promise)
    }
  }

  let actions: Promise<any>[] = []
  ctx.addDeployAction = action => {
    if (ctx.command !== 'deploy') {
      return Promise.resolve() as Promise<any>
    }
    const promise = preDeploySetup().then(() => {
      let actionContext: any = ctx
      if (typeof action !== 'function') {
        actionContext = { ...ctx }
        setLogFunctions(actionContext, action)
        action = action.run
      }
      return action(actionContext, addRevertFn)
    })
    actions.push(promise)
    return promise
  }

  task?.finish()

  try {
    await loadDeployFile(ctx)

    deploying = defer()
    queueMicrotask(() => {
      if (targetIndex == ctx.targets.length) {
        deploying!.resolve()
      }
    })

    await deploying
    await Promise.all(actions)

    const missingTargets = await getMissingTargets()
    const numChanged =
      missingTargets.length + updatedTargets.size + spawnedTargets.size

    if (!ctx.effective && numChanged == 0 && files.numChanged == 0) {
      return logger.info(
        yellow(
          `\nThis deployment had no side effects.` +
            `\nIf you expected otherwise, you might have a deploy target` +
            ` that's missing necessary metadata to detect changes.`
        )
      )
    }

    if (missingTargets.length) {
      task = task && startTask('Killing obsolete targets...')
      for (const [plugin, target] of missingTargets.reverse()) {
        await invokeAction((activePlugin = plugin), 'kill', target)
      }
    }

    if (!options.dryRun) {
      logger.info(bold('\nDeployment complete!'))
      logActionCounts(
        spawnedTargets.size,
        updatedTargets.size,
        missingTargets.length
      )
    }
  } catch (e: any) {
    logError(e)
    if (activePlugin)
      logger.info(
        yellow(
          `Plugin "${activePlugin.name}" threw the error above.` +
            (options.dryRun ? '' : gray('\nReverting changes...\n'))
        )
      )

    deployFailed = true
    if (!options.dryRun) {
      if (options.noRevert) {
        await refreshTargetCache(true)
        await saveTargetCache()
      } else
        for (const revert of ctx.revertFns.reverse()) {
          try {
            await revert()
          } catch (e: any) {
            logger.error(e)
          }
        }
    }

    return
  } finally {
    deployLockfile.delete()
    task?.finish()
  }

  removeExitCallback(onCrash)
  await refreshTargetCache()

  if (options.dryRun) {
    const debugFile = path.resolve(ctx.root, 'targets.debug.yaml')
    fs.writeFileSync(
      debugFile,
      yaml.stringify(newTargetCache, {
        aliasDuplicateObjects: false,
      })
    )
    logger.info(
      '\n' +
        green('✔︎') +
        ' Dry run complete! Targets saved to:\n   ' +
        debugFile +
        '\n'
    )
  } else {
    await saveTargetCache()

    gitStatus = await exec('git status --porcelain', { cwd: ctx.root })
    if (gitStatus) {
      const { version = '0.0.0' } = ctx.rootPackage
      await exec('git add -A', { cwd: ctx.root })
      createCommit(`v${version}-${ctx.lastCommitHash}`, {
        cwd: ctx.root,
      })
    }
  }
}

function logActionCounts(
  spawnCount: number,
  updateCount: number,
  killCount: number
) {
  spawnCount && success(plural(spawnCount, 'target'), 'spawned.')
  updateCount && success(plural(updateCount, 'target'), 'updated.')
  killCount && success(plural(killCount, 'target'), 'killed.')
}
