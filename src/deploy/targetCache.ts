import { deployedEnv } from '@runtime/deployedEnv'
import { exec } from '@saus/deploy-utils'
import assert from 'assert'
import { startTask } from 'misty/task'
import { getDeployContext } from './context'
import { YamlFile } from './files'
import { DeployFile, DeployPlugin, DeployTarget } from './types'
import { defineTargetId, omitEphemeral } from './utils'

/** Saved targets before this index have been reused, removed, or moved. */
let reusedIndex: number
let reusedTargets: Set<DeployTarget>

// Using global state here so the deploy file can prematurely
// save the target cache. This is useful in cases where a deployment
// step isn't critical but may fail and the user is fine with
// not reverting the changes.
const targetCache = {
  file: null! as YamlFile<DeployFile>,
  version: 1,
  prevData: undefined as DeployFile | undefined,
  data: undefined as DeployFile | undefined,
  pushed: false,
}

export function loadTargetCache() {
  if (!targetCache.file) {
    const ctx = getDeployContext()
    targetCache.file = ctx.files.get('targets.yaml')
    targetCache.prevData = targetCache.file.getData() || {
      version: 0,
      plugins: {},
      targets: [],
    }
    reusedTargets = new Set()
    reusedIndex = 0
  }
  return targetCache.prevData!
}

export type SavedTargets = DeployTarget[] & {
  byPlugin: Map<DeployPlugin, DeployTarget[]>
  match: (
    target: DeployTarget,
    plugin: DeployPlugin
  ) => Promise<DeployTarget | undefined>
}

export function getSavedTargets() {
  const { targets, plugins } = loadTargetCache()

  const targetsByPluginName = Object.keys(plugins).reduce((out, pluginName) => {
    out[pluginName] = targets
      .filter(target => target.plugin == pluginName)
      .map(target => target.state)
    return out
  }, {} as Record<string, DeployTarget[]>)

  const savedTargets = targets.map(target => target.state) as SavedTargets

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
      return savedTarget._id!.hash == target._id!.hash
    })
  }
  return savedTargets
}

export function markTargetReused(
  target: DeployTarget,
  savedTargets: SavedTargets
) {
  reusedIndex = Math.max(reusedIndex, 1 + savedTargets.indexOf(target))
  reusedTargets.add(target)
}

export async function getMissingTargets() {
  const ctx = getDeployContext()
  const { targets, plugins } = loadTargetCache()
  const missing: [DeployPlugin, DeployTarget][] = []
  for (const [name, entry] of Object.entries(plugins)) {
    let plugin = await ctx.deployPlugins.get(entry, name)
    for (const target of targets) {
      if (!reusedTargets.has(target.state)) {
        plugin ||= await ctx.deployPlugins.load(entry)
        missing.push([plugin, target])
      }
    }
  }
  return missing
}

export async function refreshTargetCache(
  includeUnused?: boolean
): Promise<void> {
  const ctx = getDeployContext()
  const data: DeployFile = {
    version: targetCache.version,
    targets: [],
    plugins: {},
  }

  const cacheTarget = async (
    target: DeployTarget,
    plugin: DeployPlugin,
    entry: string
  ) => {
    const cachedPlugin = Object.entries(data.plugins).find(
      cachedPlugin => cachedPlugin[1] == entry
    )

    let pluginName = plugin.name
    if (cachedPlugin) {
      pluginName = cachedPlugin[0]
    } else {
      data.plugins[pluginName] = entry
    }

    // Ensure the target is identified.
    let targetId = target._id
    if (!targetId) {
      defineTargetId(target, await plugin.identify(target))
      targetId = target._id
    }

    // Hoist identifying keys so they show first in cached state.
    let state = hoistKeys(target, Object.keys(targetId.values))
    state = omitEphemeral(state, plugin)

    data.targets.push({
      plugin: pluginName,
      state,
    })
  }

  for (const [{ hook, plugin }, target] of ctx.targets) {
    await cacheTarget(await target, plugin!, hook!.file!)
  }

  // This branch only runs when --no-revert is used.
  // When a deployment fails, we should preserve targets that were
  // not yet compared with the current deployment plan.
  // Note that targets that were once higher up in the deployment plan
  // but then moved down before the failed deploy can be accidentally removed.
  if (includeUnused) {
    const prevData = loadTargetCache()
    const reusedTargets = prevData.targets.slice(reusedIndex)
    for (const savedTarget of reusedTargets) {
      const entry = prevData.plugins[savedTarget.plugin]
      const plugin = await ctx.deployPlugins.load(entry, savedTarget.plugin)
      await cacheTarget(savedTarget.state, plugin, entry)
    }
  }

  targetCache.data = data
  targetCache.pushed = false
}

/**
 * This is called automatically once your deploy file is finished executing.
 *
 * Regardless, you may want to call it manually if you have deployment steps
 * that could fail but wouldn't warrant reverting the deployed targets if
 * they did fail. You can call it multiple times if you need to.
 *
 * If you call this manually, only do so at the top-level of your deploy file
 * and you must `await` its result. Never call this when there are pending
 * deployment steps.
 *
 * You must pass `true` if there are still targets left to deploy.
 *
 * This does nothing when `--dry-run` is used.
 */
export async function saveTargetCache(includeUnused?: boolean) {
  const ctx = getDeployContext()
  if (ctx.dryRun) {
    return
  }

  // This condition is only true when the deploy file
  // calls this function directly.
  if (!targetCache.data || targetCache.pushed) {
    await refreshTargetCache(includeUnused)
    assert(targetCache.data)
  }

  const task = ctx.logger.isLogged('info')
    ? startTask('Saving deployment state')
    : null

  try {
    targetCache.file.setData(targetCache.data)
    ctx.files.get('env.json').setData(deployedEnv)

    // Copy the last commit message from the project history
    // to be used when committing the deployment state.
    const lastCommitMsg = await exec('git log --format=%B -n 1 head', {
      cwd: ctx.root,
    })

    if (await ctx.files.commit(lastCommitMsg)) {
      await ctx.files.push()
      targetCache.pushed = true
    }

    // Assume the caller waited until all pending deployment steps
    // were completed. If so, we can safely clear the revert queue.
    // This is important for when something fails after saving the
    // target cache, since reverting isn't necessary at that point.
    ctx.revertFns.length = 0
  } finally {
    task?.finish()
  }
}

function hoistKeys(obj: any, keys: string[]) {
  return Object.fromEntries(
    Object.entries(obj).sort(([key]) => (keys.includes(key) ? -1 : 1))
  )
}
