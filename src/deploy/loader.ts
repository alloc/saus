import { formatAsyncStack } from '@/vm/formatAsyncStack'
import { cyan, gray, green } from 'kleur/colors'
import { DeployContext } from './context'
import type { DeployHookRef } from './types'

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
) {
  const hookModule = await (typeof hookRef == 'string'
    ? context.require(hookRef)
    : hookRef.load())

  if (typeof hookModule.default !== 'function') {
    throw Error(`[saus] Deploy hook must export a function`)
  }

  const hook = hookModule.default
  const plugin = await hook(context)

  if (context.logger.isLogged('info')) {
    context.logSuccess = (...args) => {
      const arg1 = typeof args[0] == 'string' ? ' ' + args.shift() : ''
      console.log(gray(plugin.name) + green(' ✔︎') + arg1, ...args)
    }
    if (context.dryRun)
      context.logPlan = (...args) => {
        const arg1 = typeof args[0] == 'string' ? ' ' + args.shift() : ''
        console.log('💧' + cyan(plugin.name) + arg1, ...args)
      }
  }

  if (typeof hookRef !== 'string') {
    hookRef.hook = hook
    hookRef.plugin = plugin
  }
  context.deployPlugins[plugin.name] = plugin
  return plugin
}
