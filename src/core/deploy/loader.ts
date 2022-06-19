import path from 'path'
import { noop } from '../../utils/noop'
import { formatAsyncStack } from '../../vm/formatAsyncStack'
import { DeployContext } from './context'
import type { DeployHookRef } from './types'

export async function loadDeployFile(
  context: DeployContext,
  secretsPromise?: PromiseLike<void>,
  onPluginsLoaded: () => void = noop
) {
  let { deploy: execPath } = context.config.saus
  if (!execPath) {
    throw Error('[saus] Cannot deploy without `saus.deploy` configured')
  }
  execPath = path.resolve(context.root, execPath)
  try {
    await context.require(execPath)
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
