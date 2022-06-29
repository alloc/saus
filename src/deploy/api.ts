import { deployedEnv } from '@/runtime/deployedEnv'
import { defer, Deferred } from '@/utils/defer'
import { diffObjects } from '@/utils/diffObjects'
import { toObjectHash } from '@/utils/objectHash'
import { plural } from '@/utils/plural'
import { Promisable } from '@/utils/types'
import exec from '@cush/exec'
import assert from 'assert'
import { addExitCallback } from 'catch-exit'
import fs from 'fs'
import { bold, gray, green, red, yellow } from 'kleur/colors'
import { success } from 'misty'
import { startTask } from 'misty/task'
import path from 'path'
import yaml from 'yaml'
import { createCommit, vite } from '../core'
import { DeployContext, loadDeployContext } from './context'
import { loadDeployFile, loadDeployPlugin } from './loader'
import { DeployOptions } from './options'
import {
  DeployFile,
  DeployHookRef,
  DeployPlugin,
  DeployTarget,
  DeployTargetArgs,
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

  addExitCallback((signal, exitCode, error) => {
    if (error) {
      logError(error)
      process.exit(1)
    }
  })

  const targetsFile = files.get('targets.yaml')
  const targetCache = (targetsFile.getData() || {
    targets: [],
    plugins: [],
  }) as DeployFile

  const revertiblePlugins = new Set<DeployPlugin>()
  const revertFns: RevertFn[] = []
  const addRevertFn = (
    revert: RevertFn | void,
    plugin?: DeployPlugin,
    action?: string
  ) => {
    if (typeof revert == 'function') {
      revertFns.push(revert)
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

  const savedTargets = getSavedTargets(targetCache)
  const reusedTargets = new Set<DeployTarget>()
  const updatedTargets = new Set<DeployTarget>()
  const spawnedTargets = new Set<DeployTarget>()
  const targets: DeployTargetArgs[] = []
  let reusedIndex = 0
  let targetIndex = 0

  const markTargetReused = (target: DeployTarget) => {
    reusedIndex = Math.max(reusedIndex, 1 + savedTargets.indexOf(target))
    reusedTargets.add(target)
  }

  const addTarget = async (
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

      const savedTarget = await savedTargets.match(target, plugin)
      if (savedTarget) {
        changed = {}
        if (!diffObjects(savedTarget, target, changed)) {
          markTargetReused(savedTarget)
          break deploy // Nothing changed.
        }
      }

      if (savedTarget) {
        if (plugin.update) {
          await invokeAction(plugin, 'update', target, changed!)
        } else {
          await invokeAction(plugin, 'kill', target)
          await invokeAction(plugin, 'spawn', target)
        }
        updatedTargets.add(target)
        markTargetReused(savedTarget)
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

  let newTargetCache: DeployFile | undefined
  let deployFailed = false

  const refreshTargetCache = async () => {
    const newCache: DeployFile = { targets: [], plugins: [] }

    const cacheTarget = async (
      target: Promisable<DeployTarget>,
      pluginName: string,
      hookPath: string
    ) => {
      let pluginIndex = newCache.plugins.findIndex(p => p.hook == hookPath)
      if (pluginIndex < 0) {
        pluginIndex =
          newCache.plugins.push({
            name: pluginName,
            hook: hookPath,
          }) - 1
      }
      newCache.targets.push({
        plugin: pluginIndex,
        state: await target,
      })
    }

    for (let [{ hook, plugin }, target] of targets) {
      target = await target
      if (spawnedTargets.has(target) || updatedTargets.has(target)) {
        await cacheTarget(target, plugin!.name, hook!.file!)
      }
    }

    // This branch only runs when --no-revert is used.
    // When a deployment fails, we should preserve targets that were
    // not yet compared with the current deployment plan.
    // Note that targets that were once higher up in the deployment plan
    // but then moved down before the failed deploy can be accidentally removed.
    if (deployFailed) {
      for (const savedTarget of targetCache.targets.slice(reusedIndex)) {
        const plugin = targetCache.plugins[savedTarget.plugin]
        await cacheTarget(savedTarget.state, plugin.name, plugin.hook)
      }
    }

    return newCache
  }

  const saveTargetCache = async () => {
    assert(newTargetCache)
    assert(!options.dryRun)
    task = startTask('Saving deployment state')
    try {
      files.get('env.json').setData(deployedEnv)
      targetsFile.setData(newTargetCache)
      await pushCachedTargets(context)
    } finally {
      task?.finish()
    }
  }

  let loading: Promise<any> | undefined

  context.addDeployTarget = async (...args) => {
    await (loading ||= (async () => {
      const missing = await context.secrets.load()
      if (missing) {
        throw Error(
          '[saus] Secrets are missing:\n' +
            Array.from(missing, name => `  - ` + name).join('\n')
        )
      }
      await Promise.all(
        context.deployHooks.map(hookRef => {
          return loadDeployPlugin(hookRef, context)
        })
      )
    })())

    const index = targets.push(args) - 1
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

  try {
    await loadDeployFile(context)

    deploying = defer()
    queueMicrotask(() => {
      if (targetIndex == targets.length) {
        deploying!.resolve()
      }
    })

    await deploying
    await Promise.all(actions)

    const missingTargets = await getMissingTargets(
      targetCache,
      reusedTargets,
      context
    )

    const numChanged =
      missingTargets.length + updatedTargets.size + spawnedTargets.size

    if (numChanged == 0) {
      return logger.info(
        '\nNo deployment actions were required.' +
          '\nIf you expected otherwise, you might have a deploy target' +
          " that's missing necessary metadata to detect changes."
      )
    }

    task = task && startTask('Killing obsolete targets...')
    for (const [plugin, target] of missingTargets.reverse()) {
      await invokeAction((activePlugin = plugin), 'kill', target)
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
        newTargetCache = await refreshTargetCache()
        await saveTargetCache()
      } else
        for (const revert of revertFns.reverse()) {
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

  if (options.dryRun) {
    const debugFile = path.resolve(context.root, 'targets.debug.yaml')
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
    newTargetCache = await refreshTargetCache()
    await saveTargetCache()

    gitStatus = await exec('git status --porcelain', { cwd: context.root })
    if (gitStatus) {
      const { version = '0.0.0' } = context.rootPackage
      await exec('git add -A', { cwd: context.root })
      await createCommit(`v${version}-${context.lastCommitHash}`, {
        cwd: context.root,
      })
    }
  }
}

type SavedTargets = DeployTarget[] & {
  byPlugin: Map<DeployPlugin, DeployTarget[]>
  match: (
    target: DeployTarget,
    plugin: DeployPlugin
  ) => Promise<DeployTarget | undefined>
}

function getSavedTargets(targetCache: DeployFile) {
  const targetsByPluginName = targetCache.plugins.reduce(
    (targets, plugin, index) => {
      targets[plugin.name] = targetCache.targets
        .filter(target => target.plugin == index)
        .map(target => target.state)
      return targets
    },
    {} as Record<string, DeployTarget[]>
  )

  const savedTargets = targetCache.targets.map(
    target => target.state
  ) as SavedTargets

  savedTargets.byPlugin = new Map()
  savedTargets.match = async (target, plugin) => {
    let targets = savedTargets.byPlugin.get(plugin)
    if (!targets) {
      targets = targetsByPluginName[plugin.name] || []
      await Promise.all(
        targets.map(async savedTarget => {
          defineTargetId(savedTarget, await plugin.identify(savedTarget))
        })
      )
      savedTargets.byPlugin.set(plugin, targets)
    }
    return targets.find(savedTarget => {
      return savedTarget._id == target._id
    })
  }
  return savedTargets
}

async function getMissingTargets(
  targetCache: DeployFile,
  reusedTargets: Set<DeployTarget>,
  context: DeployContext
) {
  const pendingPlugins: Record<string, Promise<any>> = {}
  const missing: [DeployPlugin, DeployTarget][] = []
  for (const props of targetCache.plugins) {
    let plugin =
      context.deployPlugins[props.name] || (await pendingPlugins[props.hook])
    for (const target of targetCache.targets) {
      if (!reusedTargets.has(target.state)) {
        if (!plugin) {
          const pendingPlugin = loadDeployPlugin(props.hook, context)
          plugin = await (pendingPlugins[props.hook] = pendingPlugin)
        }
        missing.push([plugin, target])
      }
    }
  }
  return missing
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
