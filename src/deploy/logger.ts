import { cyan, gray, green, yellow } from 'kleur/colors'
import { DeployContext } from './context'

export function setLogFunctions(
  context: DeployContext,
  plugin: { name: string }
): void {
  if (context.logger.isLogged('info')) {
    context.logActivity = (...args) => {
      const arg1 = typeof args[0] == 'string' ? ' ' + args.shift() : ''
      console.log(gray(plugin.name) + yellow(' ⦿') + arg1, ...args)
    }
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
}
