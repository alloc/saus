import exec from '@cush/exec'
import fs from 'fs'
import { yellow } from 'kleur/colors'
import { success } from 'misty'
import { startTask } from 'misty/task'
import path from 'path'
import yaml from 'yaml'
import { plural } from './core'
import { BundleContext } from './core/bundle'
import {
  DeployContext,
  DeployHook,
  DeployHooks,
  DeployPlugin,
  DeployTarget,
  RevertFn,
} from './core/deploy'
import { prepareDeployContext } from './core/deploy/context'
import { YamlFile } from './core/deploy/files'
import { DeployOptions } from './core/deploy/options'
import { loadDeployFile } from './core/loadDeployFile'
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

  const targetsByHook = await loadDeployFile(context)

  task?.finish()
  task = task && startTask('Loading secrets')

  // Load secrets after deploy hooks are loaded.
  // This lets deploy plugins add sources to load secrets from.
  if (await context.secrets.load()) {
    task?.finish()
    return
  }

  task?.finish()
  task = task && startTask('Planning deployment')

  const targetsFile = files.get('targets.yaml')
  const pluginsByHook = new Map<DeployHook, DeployPlugin>()
  const actionsByPlugin = await generateActions(
    targetsFile,
    targetsByHook,
    pluginsByHook,
    context
  )

  task?.finish()

  if (!actionsByPlugin.size) {
    return logger.info(
      '\nNo deployment actions were required.' +
        '\nIf you expected otherwise, you might have a deploy target' +
        " that's missing necessary metadata to detect changes."
    )
  }

  task = task && startTask('Building targets')

  const buildPromises: Promisable<void>[] = []
  for (const [plugin, actions] of actionsByPlugin) {
    if (!plugin.build) continue
    for (const action of actions) {
      if (action.type == 'kill') continue
      buildPromises.push(
        plugin.build(
          action.target,
          action.type == 'update' ? action.changed : undefined
        )
      )
    }
  }

  await Promise.all(buildPromises)

  task?.finish()
  task = task && startTask('Deploying targets')

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

  let spawnCount = 0
  let updateCount = 0
  let killCount = 0

  let currentPlugin!: DeployPlugin
  try {
    for (const [plugin, actions] of actionsByPlugin) {
      currentPlugin = plugin
      for (const action of actions) {
        const { target } = action
        let revert: RevertFn | void
        if (action.type == 'update') {
          if (plugin.update) {
            revert = await plugin.update(target, action.changed)
            addRevertFn(revert, plugin, 'update')
          } else {
            revert = await plugin.kill(target)
            addRevertFn(revert, plugin, 'kill')
            revert = await plugin.spawn(target)
            addRevertFn(revert, plugin, 'spawn')
          }
          updateCount++
        } else if (action.type == 'spawn') {
          revert = await plugin.spawn(target)
          addRevertFn(revert, plugin, 'spawn')
          spawnCount++
        } else {
          revert = await plugin.kill(target)
          addRevertFn(revert, plugin, 'kill')
          killCount++
        }
      }
    }
    for (const plugin of actionsByPlugin.keys()) {
      if (plugin.finalize) {
        currentPlugin = plugin
        const revert = await plugin.finalize()
        if (revert) {
          revertFns.push(revert)
        }
      }
    }
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

  const targetsByPlugin: Record<string, DeployTarget[]> = {}
  for (const [hook, targets] of targetsByHook) {
    const { name } = pluginsByHook.get(hook)!
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

type DeployAction =
  | { type: 'spawn'; target: DeployTarget }
  | { type: 'update'; target: DeployTarget; changed: Record<string, any> }
  | { type: 'kill'; target: DeployTarget }

async function generateActions(
  targetsFile: YamlFile,
  targetsByHook: DeployHooks,
  pluginsByHook: Map<DeployHook, DeployPlugin>,
  context: DeployContext
) {
  const hooksByPlugin = new Map<DeployPlugin, DeployHook>()
  const plugins: Record<string, DeployPlugin> = {}
  for (const hook of targetsByHook.keys()) {
    const plugin = await hook(context)
    plugins[plugin.name] = plugin
    pluginsByHook.set(hook, plugin)
    hooksByPlugin.set(plugin, hook)
  }
  const actionsByPlugin = new Map<DeployPlugin, DeployAction[]>()
  const pushAction = (plugin: DeployPlugin, action: DeployAction) => {
    let actions = actionsByPlugin.get(plugin)
    if (!actions) {
      actions = []
      actionsByPlugin.set(plugin, actions)
    }
    actions.push(action)
  }
  if (targetsFile.exists) {
    const cachedTargets = targetsFile.getData() as {
      [name: string]: DeployTarget[]
    }
    for (const name in cachedTargets) {
      const plugin = plugins[name]
      if (plugin) {
        const hook = hooksByPlugin.get(plugin)!
        const targets = targetsByHook.get(hook)!
        const targetsById: Record<string, DeployTarget> = {}
        for (const target of targets) {
          defineTargetId(target, await plugin.identify(target))
          targetsById[target._id] = target
        }
        for (const cachedTarget of cachedTargets[name]) {
          defineTargetId(cachedTarget, await plugin.identify(cachedTarget))
          const target = targetsById[cachedTarget._id]
          if (!target) {
            pushAction(plugin, { type: 'kill', target: cachedTarget })
          } else {
            const changed: Record<string, any> = {}
            if (diffObjects(cachedTarget, target, changed)) {
              pushAction(plugin, { type: 'update', target, changed })
            }
          }
        }
      } else {
        context.logger.warn(
          yellow(`[saus] Deployed target is missing its plugin: ${name}`)
        )
      }
    }
  } else {
    targetsByHook.forEach((targets, hook) => {
      const plugin = pluginsByHook.get(hook)!
      for (const target of targets) {
        pushAction(plugin, { type: 'spawn', target })
      }
    })
  }
  return actionsByPlugin
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
