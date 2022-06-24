import { formatAsyncStack } from '@/vm/formatAsyncStack'
import path from 'path'
import { DeployContext } from './context'
import type { DeployHookRef } from './types'

export async function loadDeployFile(context: DeployContext) {
  let { deploy: deployConfig } = context.config.saus
  if (!deployConfig) {
    throw Error('[saus] Cannot deploy without `saus.deploy` configured')
  }
  const entry = path.resolve(context.root, deployConfig.entry)
  try {
    await context.require(entry)
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
