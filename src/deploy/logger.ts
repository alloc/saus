import { cyan, gray, green, red, yellow } from 'kleur/colors'
import { MistyTask, startTask } from 'misty/task'
import { DeployContext } from './context'

export function setLogFunctions(
  ctx: DeployContext,
  plugin: { name: string }
): void {
  if (ctx.logger.isLogged('info')) {
    ctx.logActivity = (...args) => {
      const arg1 = typeof args[0] == 'string' ? ' ' + args.shift() : ''
      console.log(gray(plugin.name) + yellow(' ⦿') + arg1, ...args)
    }
    ctx.logSuccess = (...args) => {
      const arg1 = typeof args[0] == 'string' ? ' ' + args.shift() : ''
      console.log(gray(plugin.name) + green(' ✔︎') + arg1, ...args)
    }
    ctx.logPlan = async (msg, action) => {
      let [verb, ...rest] = msg.split(' ')
      let verbLastChar = verb[verb.length - 1]

      const prefix = gray(plugin.name) + ' '
      const suffix = ' ' + rest.join(' ')

      let task: MistyTask | undefined
      if (ctx.dryRun) {
        console.log(prefix + cyan(' ◯') + ('would ' + verb) + suffix)
      } else if (action) {
        task = startTask(
          prefix +
            yellow(' ⦿') +
            ((verbLastChar == 't'
              ? verb + 't'
              : verbLastChar == 'e'
              ? verb.slice(0, -1)
              : verb) +
              'ing') +
            suffix,
          { footer: true }
        )
        let result: any
        try {
          result = await action()
          task?.finish(
            prefix +
              green(' ✔︎') +
              (verbLastChar == 'y' ? verb.slice(0, -1) + 'i' : verb) +
              'ed' +
              suffix
          )
        } catch (e: any) {
          task?.finish(prefix + red(' ✗') + 'failed to ' + verb + suffix)
          throw e
        }
        return result
      }
    }
  }
}
