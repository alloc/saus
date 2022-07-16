import { cyan, gray, green, red, yellow } from 'kleur/colors'
import { startTask } from 'misty/task'
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

      const prefix = gray(plugin.name) + ' '
      const suffix = ' ' + rest.join(' ')

      if (ctx.dryRun) {
        console.log(prefix + cyan('⦿ ') + ('would ' + verb) + suffix)
      } else if (action) {
        const task = startTask(
          prefix + yellow('⦿ ') + toPresentTense(verb) + suffix,
          { footer: true }
        )
        let result: any
        try {
          result = await action()
          task.finish()
          ctx.logger.info(prefix + green('✔︎ ') + toPastTense(verb) + suffix)
        } catch (e: any) {
          task.finish()
          ctx.logger.info(prefix + red('✗ ') + 'failed to ' + verb + suffix)
          throw e
        }
        return result
      }
    }
  }
}

// These functions are intended to serve common use cases,
// and so they're not bullet proof.
function toPastTense(verb: string) {
  const lastChar = verb[verb.length - 1]
  return lastChar == 'e'
    ? verb + 'd'
    : (/[^aeiou]y$/.test(verb)
        ? verb.slice(0, -1) + 'i'
        : needLastCharDoubled(verb)
        ? verb + lastChar
        : verb) + 'ed'
}

function toPresentTense(verb: string) {
  const lastChar = verb[verb.length - 1]
  return (
    (lastChar == 'e'
      ? verb.slice(0, -1)
      : needLastCharDoubled(verb)
      ? verb + lastChar
      : verb) + 'ing'
  )
}

function needLastCharDoubled(verb: string) {
  return /[aeiou][bdlmnprt]$/.test(verb) && !/(ea|ee|oo)[bdlmnprt]$/.test(verb)
}
