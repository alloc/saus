import exec from '@cush/exec'
import fs from 'fs'
import { yellow } from 'kleur/colors'
import { success } from 'misty'
import { startTask } from 'misty/task'
import path from 'path'
import yaml from 'yaml'
import { plural } from './core'
import { BundleContext, loadBundleContext } from './core/bundle'
import {
  DeployContext,
  DeployHook,
  DeployHooks,
  DeployPlugin,
  DeployTarget,
  injectDeployContext,
  RevertFn,
} from './core/deploy'
import { loadDeployHooks } from './core/loadDeployHooks'
import { toObjectHash } from './utils/objectHash'
import { Promisable } from './utils/types'

export interface DeployOptions {
  /**
   * Deploy to a git respository other than `origin`.
   */
  gitRepo?: { name: string; url: string }
  /**
   * Kill all deployed targets.
   */
  killAll?: boolean
}

/**
 * Identical to running `saus deploy` from the terminal.
 */
export async function deploy(
  options: DeployOptions = {},
  bundleContext?: BundleContext
) {
  const context = (bundleContext ||
    (await loadBundleContext())) as DeployContext

  if (await exec('git status --porcelain', { cwd: context.root })) {
    throw Error('[saus] Cannot deploy with unstaged changes')
  }

  context.gitRepo =
    options.gitRepo || (await getGitRepoByName('origin', context))
  injectDeployContext(context)

  const targetsByHook = await loadDeployHooks(context)
  if (!targetsByHook.size) {
    throw Error('[saus] Nothing to deploy')
  }

  const { logger } = context

  let task = logger.isLogged('info')
    ? startTask('Reading deployment state')
    : null

  const cacheDir = path.resolve(context.root, 'node_modules/.saus/deployed')
  fs.mkdirSync(cacheDir, { recursive: true })
  await pullCachedTargets(cacheDir, 'deployed', context)

  const targetsFile = path.join(cacheDir, 'targets.yaml')
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
          } else {
            revert = await plugin.kill(target)
            if (typeof revert == 'function') {
              revertFns.push(revert)
            }
            revert = await plugin.spawn(target)
          }
          updateCount++
        } else if (action.type == 'spawn') {
          revert = await plugin.spawn(target)
          spawnCount++
        } else {
          revert = await plugin.kill(target)
          killCount++
        }
        if (typeof revert == 'function') {
          revertFns.push(revert)
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
      `Plugin "${currentPlugin.name}" threw an error. Reverting prior changes...`
    )
    for (const revert of revertFns.reverse()) {
      await revert()
    }
    throw e
  }

  if (task) {
    task.finish()
    logActionCounts(spawnCount, updateCount, killCount)
    task = startTask('Saving deployment state')
  }

  const targetsByPlugin: Record<string, DeployTarget[]> = {}
  for (const [hook, targets] of targetsByHook) {
    const { name } = pluginsByHook.get(hook)!
    targetsByPlugin[name] = targets
  }

  fs.writeFileSync(targetsFile, yaml.stringify(targetsByPlugin))
  await pushCachedTargets(cacheDir, context)

  task?.finish()
}

type DeployAction =
  | { type: 'spawn'; target: DeployTarget }
  | { type: 'update'; target: DeployTarget; changed: Record<string, any> }
  | { type: 'kill'; target: DeployTarget }

async function generateActions(
  targetsFile: string,
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
  if (fs.existsSync(targetsFile)) {
    const cachedTargets = yaml.parse(fs.readFileSync(targetsFile, 'utf8')) as {
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

async function pushCachedTargets(cacheDir: string, context: DeployContext) {
  const lastCommitMsg = await exec('git log --format=%B -n 1 head', {
    cwd: context.root,
  })

  await exec('git add -A', { cwd: cacheDir })
  await exec('git commit -m', [lastCommitMsg], { cwd: cacheDir })
  await exec('git push', { cwd: cacheDir })
}

async function pullCachedTargets(
  cacheDir: string,
  targetBranch: string,
  { gitRepo }: DeployContext
) {
  if (!fs.existsSync(path.join(cacheDir, '.git'))) {
    await exec('git init', { cwd: cacheDir })
    await exec('git remote add', [gitRepo.name, gitRepo.url], {
      cwd: cacheDir,
    })
  }
  try {
    await exec('git pull', [gitRepo.name, targetBranch], { cwd: cacheDir })
  } catch (e: any) {
    if (!/Couldn't find remote ref/.test(e.message)) {
      throw e
    }
    await exec('git commit -m "init" --allow-empty', { cwd: cacheDir })
    await exec('git push -u', [gitRepo.name, 'master:' + targetBranch], {
      cwd: cacheDir,
    })
  }
}

async function getGitRepoByName(name: string, context: DeployContext) {
  const remotes = parseRemotes(
    await exec('git remote -v', { cwd: context.root })
  )
  const repo = remotes.find(repo => repo.type == 'push' && repo.name == name)
  if (!repo) {
    throw Error('[saus] Repository not found: ' + name)
  }
  return repo
}

function parseRemotes(text: string) {
  return text.split('\n').map(line => {
    const [name, url, type] = line.split(/\s+/)
    return { type: type.slice(1, -1) as 'fetch' | 'push', name, url }
  })
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
