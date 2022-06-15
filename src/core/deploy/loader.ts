import path from 'path'
import { formatAsyncStack } from '../../vm/formatAsyncStack'
import { DeployContext } from './context'
import type { DeployHookRef } from './types'

export async function loadDeployFile(
  context: DeployContext,
  onPluginsLoaded: () => void
) {
  let { deploy: execPath } = context.config.saus
  if (!execPath) {
    throw Error('[saus] Cannot deploy without `saus.deploy` configured')
  }
  execPath = path.resolve(context.root, execPath)
  try {
    const promise = context.require(execPath)
    // Secret sources must be added synchronously, since they need
    // to be loaded before hooks/plugins.
    await context.secrets.load()
    if (context.command == 'deploy')
      await Promise.all(
        Object.values(context.deployHooks).map(hookRef =>
          loadDeployPlugin(hookRef, context)
        )
      )
    onPluginsLoaded()
    await promise
  } catch (error: any) {
    formatAsyncStack(error, context.moduleMap, [], context.config.filterStack)
    throw error
  }
}

export async function loadDeployPlugin(
  hookRef: DeployHookRef | string,
  context: DeployContext
) {
  const hookModule = await (typeof hookRef == 'string'
    ? context.require(hookRef)
    : hookRef.load())

  if (typeof hookModule.default !== 'function') {
    throw Error(`[saus] Deploy hook must export a function`)
  }

  const hook = hookModule.default
  const plugin = await hook(context)

  if (typeof hookRef !== 'string') {
    hookRef.hook = hook
    hookRef.plugin = plugin
  }
  context.deployPlugins[plugin.name] = plugin
  return plugin
}
