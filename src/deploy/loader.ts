import { formatAsyncStack } from '@/vm/formatAsyncStack'
import { DeployContext } from './context'
import { setLogFunctions } from './logger'
import type { DeployHookRef, DeployPlugin } from './types'

export async function loadDeployFile(context: DeployContext) {
  try {
    await context.ssrRequire(context.deployPath)
  } catch (error: any) {
    formatAsyncStack(error, context.moduleMap, [], context.config.filterStack)
    throw error
  }
}

export async function loadDeployPlugin(
  hookRef: DeployHookRef | string,
  { ...context }: DeployContext
): Promise<DeployPlugin> {
  const hookModule = await (typeof hookRef == 'string'
    ? context.require(hookRef)
    : hookRef.load())

  if (typeof hookModule.default !== 'function') {
    throw Error(`[saus] Deploy hook must export a function`)
  }

  const hook = hookModule.default
  const plugin: DeployPlugin = await hook(context)
  setLogFunctions(context, plugin)

  if (typeof hookRef !== 'string') {
    hookRef.hook = hook
    hookRef.plugin = plugin
  }
  context.deployPlugins[plugin.name] = plugin
  return plugin
}
