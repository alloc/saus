import exec from '@cush/exec'
import fs from 'fs'
import { success } from 'misty'
import { startTask } from 'misty/task'
import path from 'path'
import yaml from 'yaml'
import { plural } from './core'
import { BundleContext } from './core/bundle'
import {
  DeployContext,
  DeployFile,
  DeployHookRef,
  DeployPlugin,
  DeployTarget,
  RevertFn,
} from './core/deploy'
import { DeployTargetArgs, prepareDeployContext } from './core/deploy/context'
import { loadDeployFile, loadDeployPlugin } from './core/deploy/loader'
import { DeployOptions } from './core/deploy/options'
import { defer } from './utils/defer'
import { toObjectHash } from './utils/objectHash'
import { Promisable } from './utils/types'

/**
 * Identical to running `saus deploy` from the terminal.
 */
export async function deploy(
  options: DeployOptions = {},
  bundleContext?: Promisable<BundleContext>
) {
  const context = await prepareDeployContext(options, bundleContext)
  const { files, logger } = context

  const gitStatus = await exec('git status --porcelain', { cwd: context.root })
  if (!options.dryRun && gitStatus) {
    throw Error('[saus] Cannot deploy with unstaged changes')
  }

  const deployLockfile = files.get('deploy.lock')
  if (!options.dryRun && deployLockfile.exists) {
    throw Error('[saus] A deployment is already in progress')
  }

  // Prevent parallel runs of `saus deploy`.
  deployLockfile.setBuffer(Buffer.alloc(1))

  let task = logger.isLogged('info')
    ? startTask('Loading deployment targets')
    : null

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
    plugin: DeployPlugin,
    action: string
  ) => {
    if (typeof revert == 'function') {
      revertFns.push(revert)
    } else if (!options.dryRun) {
      logger.warnOnce(
        `Beware: Plugin "${plugin.name}" did not return a rollback function ` +
          `for its "${action}" action. If an error happens while deploying, its ` +
          `effects won't be automatically reversible!`
      )
    }
  }

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

    await loadingPlugins
    const plugin = hook.plugin!

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

    if (index == targetIndex && ++targetIndex < targets.length) {
      queueMicrotask(() => {
        const [hook, target, resolve] = targets[targetIndex]
        resolve(addTarget(hook, target))
      })
    }
    return target
  }

  context.addTarget = (...args) => {
    if (targetIndex == targets.length) {
      const [hook, target, resolve] = args
      resolve(addTarget(hook, target))
    }
    targets.push(args)
  }

  const loadingPlugins = defer<void>()
  await loadDeployFile(context, loadingPlugins.resolve)

  task?.finish()
  task = task && startTask('Killing unused targets...')

  let killedTargets: Awaited<ReturnType<typeof getKillableTargets>>
  try {
    killedTargets = await getKillableTargets(
      targetCache,
      reusedTargets,
      context
    )
    for (const [plugin, target] of killedTargets) {
      const revert = await plugin.kill(target)
      addRevertFn(revert, plugin, 'kill')
    }
  } finally {
    task?.finish()
  }

  const numChanged =
    killedTargets.length + updatedTargets.length + addedTargets.length

  if (numChanged == 0) {
    return logger.info(
      '\nNo deployment actions were required.' +
        '\nIf you expected otherwise, you might have a deploy target' +
        " that's missing necessary metadata to detect changes."
    )
  }

  let currentPlugin!: DeployPlugin
  try {
  } catch (e: any) {
    logger.error(e, { error: e })
    logger.info(
      `Plugin "${currentPlugin.name}" threw an error.` +
        (options.dryRun ? '' : ' Reverting changes...')
    )
    if (!options.dryRun)
      for (const revert of revertFns.reverse()) {
        await revert()
      }
    deployLockfile.delete()
    throw e
  }

  task?.finish()

  const newTargetCache: DeployFile = {}
  for (const [hook, target] of targets) {
    const name = hook.plugin!.name
    targetsByPlugin[name] = targets
  }

  deployLockfile.delete()

  if (options.dryRun) {
    const debugFile = path.resolve(context.root, 'targets.debug.yaml')
    fs.writeFileSync(debugFile, yaml.stringify(targetsByPlugin))
    if (logger.isLogged('info')) {
      success('Dry run complete! Targets saved to:\n    ' + debugFile)
    }
  } else {
    logActionCounts(spawnCount, updateCount, killCount)
    task = startTask('Saving deployment state')

    targetsFile.setData(targetsByPlugin)
    await pushCachedTargets(context)

    task?.finish()
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

function diffObjects(
  oldValues: any,
  values: any,
  changed: Record<string, any>
) {
  let differs = false
  const diff = (key: string, oldValue: any, value: any) => {
    if (isPlainObject(oldValue) && isPlainObject(value)) {
      if (diffObjects(oldValue, value, (changed[key] = {}))) {
        differs = true
      }
    } else if (Array.isArray(oldValue) && Array.isArray(value)) {
      if (!equalArrays(oldValue, value)) {
        changed[key] = differs = true
      }
    } else if (oldValue !== value) {
      changed[key] = differs = true
    }
  }
  for (const key in values) {
    diff(key, oldValues[key], values[key])
  }
  for (const key in oldValues) {
    if (!(key in values)) {
      diff(key, oldValues[key], values[key])
    }
  }
  return differs
}

function equalArrays(oldValues: any[], values: any[]) {
  if (oldValues.length !== values.length) {
    return false
  }
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    const oldValue = oldValues[i]
    if (isPlainObject(oldValue) && isPlainObject(value)) {
      if (diffObjects(oldValue, value, {})) {
        return false
      }
    } else if (Array.isArray(oldValue) && Array.isArray(value)) {
      if (!equalArrays(oldValue, value)) {
        return false
      }
    } else if (oldValue !== value) {
      return false
    }
  }
  return true
}

function isPlainObject(value: any): value is object {
  return value !== null && typeof value == 'object'
}
