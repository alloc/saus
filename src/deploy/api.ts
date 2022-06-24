import { deployedEnv } from '@/runtime/deployedEnv'
import { defer, Deferred } from '@/utils/defer'
import { diffObjects } from '@/utils/diffObjects'
import { toObjectHash } from '@/utils/objectHash'
import { plural } from '@/utils/plural'
import { Promisable } from '@/utils/types'
import exec from '@cush/exec'
import fs from 'fs'
import { success } from 'misty'
import { startTask } from 'misty/task'
import path from 'path'
import yaml from 'yaml'
import { vite } from '../core'
import { DeployContext, DeployTargetArgs, loadDeployContext } from './context'
import { loadDeployFile, loadDeployPlugin } from './loader'
import { DeployOptions } from './options'
import {
  DeployFile,
  DeployHookRef,
  DeployPlugin,
  DeployTarget,
  RevertFn,
} from './types'

export { DeployOptions }

/**
 * Identical to running `saus deploy` from the terminal.
 */
export async function deploy(
  options: DeployOptions = {},
  inlineConfig: vite.UserConfig = {}
) {
  const context = await loadDeployContext(options, inlineConfig)

  let gitStatus = await exec('git status --porcelain', { cwd: context.root })
  if (!options.dryRun && gitStatus) {
    throw Error('[saus] Cannot deploy with unstaged changes')
  }

  const { files, logger } = context

  const deployLockfile = files.get('deploy.lock')
  if (!options.dryRun && deployLockfile.exists) {
    throw Error('[saus] A deployment is already in progress')
  }

  // Prevent parallel runs of `saus deploy`.
  deployLockfile.setBuffer(Buffer.alloc(1))

  let task = logger.isLogged('info')
    ? startTask('Preparing to deploy...')
    : null

  await context.syncDeployCache()

  const targetsFile = files.get('targets.yaml')
  const targetCache = targetsFile.getData() as DeployFile

  const savedTargetsByPlugin = new Map<DeployPlugin, DeployTarget[]>()
  const findSavedTarget = async (
    target: DeployTarget,
    plugin: DeployPlugin
  ) => {
    let savedTargets = savedTargetsByPlugin.get(plugin)
    if (!savedTargets) {
      savedTargets = targetCache[plugin.name].targets
      await Promise.all(
        savedTargets.map(async savedTarget => {
          defineTargetId(savedTarget, await plugin.identify(savedTarget))
        })
      )
      savedTargetsByPlugin.set(plugin, savedTargets)
    }
    return savedTargets.find(savedTarget => savedTarget._id == target._id)
  }

  const revertFns: RevertFn[] = []
  const addRevertFn = (
    revert: RevertFn | void,
    plugin?: DeployPlugin,
    action?: string
  ) => {
    if (typeof revert == 'function') {
      revertFns.push(revert)
    } else if (plugin && !options.dryRun) {
      logger.warnOnce(
        `Beware: Plugin "${plugin.name}" did not return a rollback function ` +
          `for its "${action}" action. If an error happens while deploying, its ` +
          `effects won't be automatically reversible!`
      )
    }
  }

  // This is defined after the `loadDeployFile` promise is resolved.
  // Until then, we assume a new target may be added at some point.
  let deploying: Deferred<void> | undefined
  let activePlugin: DeployPlugin = null!

  const reusedTargets = new Set<DeployTarget>()
  const updatedTargets: DeployTarget[] = []
  const addedTargets: DeployTarget[] = []
  const targets: DeployTargetArgs[] = []
  let targetIndex = 0

  const addTarget = async (
    hook: DeployHookRef,
    target: Promisable<DeployTarget>
  ) => {
    const index = targetIndex
    const plugin = (activePlugin = hook.plugin!)
    try {
      target = await target
      if (plugin.pull) {
        const pulled = await plugin.pull(target)
        if (pulled) {
          Object.assign(target, pulled)
        }
      }

      defineTargetId(target, await plugin.identify(target))

      let changed: Record<string, any> | undefined

      const savedTarget = await findSavedTarget(target, plugin)
      if (savedTarget) {
        reusedTargets.add(savedTarget)
        changed = {}
        if (!diffObjects(savedTarget, target, changed)) {
          return target // Nothing changed.
        }
      }

      let revert: RevertFn | void
      if (savedTarget) {
        if (plugin.update) {
          revert = await plugin.update(target, changed!)
          addRevertFn(revert, plugin, 'update')
        } else {
          revert = await plugin.kill(savedTarget)
          addRevertFn(revert, plugin, 'kill')
          revert = await plugin.spawn(target)
          addRevertFn(revert, plugin, 'spawn')
        }
        updatedTargets.push(target)
      } else {
        revert = await plugin.spawn(target)
        addRevertFn(revert, plugin, 'spawn')
        addedTargets.push(target)
      }
    } catch (e: any) {
      return (deploying || Promise).reject(e)
    }

    if (index == targetIndex) {
      if (++targetIndex < targets.length) {
        queueMicrotask(() => {
          const [hook, target, resolve] = targets[targetIndex]
          resolve(addTarget(hook, target))
        })
      } else {
        deploying?.resolve()
      }
    }
    return target
  }

  context.addDeployTarget = async (...args) => {
    const index = targets.push(args) - 1
    if (index == 0) {
      await context.secrets.load()
      await Promise.all(
        context.deployHooks.map(hookRef => {
          return loadDeployPlugin(hookRef, context)
        })
      )
    }
    if (index == targetIndex) {
      const [hook, target, resolve] = args
      resolve(addTarget(hook, target))
    }
  }

  let actions: Promise<any>[] = []
  context.addDeployAction = action => {
    const promise = new Promise<any>(resolve => {
      if (context.command == 'deploy') {
        resolve(action(context as any, addRevertFn))
      }
    })
    actions.push(promise)
    return promise
  }

  task?.finish()
  task = task && startTask('Deploying...')

  try {
    await loadDeployFile(context)
    await (deploying = defer())
    await Promise.all(actions)

    const killedTargets = await getKillableTargets(
      targetCache,
      reusedTargets,
      context
    )

    task?.finish()
    const numChanged =
      killedTargets.length + updatedTargets.length + addedTargets.length

    if (numChanged == 0) {
      return logger.info(
        '\nNo deployment actions were required.' +
          '\nIf you expected otherwise, you might have a deploy target' +
          " that's missing necessary metadata to detect changes."
      )
    }

    task = task && startTask('Killing obsolete targets...')
    for (const [plugin, target] of killedTargets) {
      const revert = await (activePlugin = plugin).kill(target)
      addRevertFn(revert, plugin, 'kill')
    }

    if (!options.dryRun) {
      logActionCounts(
        addedTargets.length,
        updatedTargets.length,
        killedTargets.length
      )
    }
  } catch (e: any) {
    logger.error(e, { error: e })
    logger.info(
      `Plugin "${activePlugin.name}" threw an error.` +
        (options.dryRun ? '' : ' Reverting changes...')
    )
    if (!options.dryRun)
      for (const revert of revertFns.reverse()) {
        await revert()
      }
    throw e
  } finally {
    deployLockfile.delete()
    task?.finish()
  }

  const newTargetCache: DeployFile = {}
  for (const [{ hook, plugin }, target] of targets) {
    const name = plugin!.name
    const cached = (newTargetCache[name] ||= { hook: hook!.file!, targets: [] })
    cached.targets.push(target)
  }

  if (options.dryRun) {
    const debugFile = path.resolve(context.root, 'targets.debug.yaml')
    fs.writeFileSync(debugFile, yaml.stringify(newTargetCache))
    if (logger.isLogged('info')) {
      success('Dry run complete! Targets saved to:\n    ' + debugFile)
    }
  } else {
    task = startTask('Saving deployment state')
    try {
      files.get('env.json').setData(deployedEnv)
      targetsFile.setData(newTargetCache)
      await pushCachedTargets(context)
    } finally {
      task?.finish()
    }
    gitStatus = await exec('git status --porcelain', { cwd: context.root })
    if (gitStatus) {
      const { version = '0.0.0' } = context.rootPackage
      await exec('git add -A', { cwd: context.root })
      await exec(`git commit -m "v${version}-${context.lastCommitHash}"`, {
        cwd: context.root,
      })
    }
  }
}

async function getKillableTargets(
  targetsFile: DeployFile,
  reusedTargets: Set<DeployTarget>,
  context: DeployContext
) {
  const killables: [DeployPlugin, DeployTarget][] = []
  for (const [name, state] of Object.entries(targetsFile)) {
    const plugin =
      context.deployPlugins[name] ||
      (await loadDeployPlugin(state.hook, context))

    for (const target of state.targets) {
      if (!reusedTargets.has(target)) {
        killables.push([plugin, target])
      }
    }
  }
  return killables
}

function defineTargetId(
  target: DeployTarget,
  values: Record<string, any>
): asserts target is DeployTarget & { _id: string } {
  Object.defineProperty(target, '_id', {
    value: toObjectHash(values),
  })
}

async function pushCachedTargets({ root, files }: DeployContext) {
  const lastCommitMsg = await exec('git log --format=%B -n 1 head', {
    cwd: root,
  })
  if (await files.commit(lastCommitMsg)) {
    await files.push()
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
