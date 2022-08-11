import { CAC, Command } from 'cac'
import { red } from 'kleur/colors'

const commands: {
  action: Function
  unnamedArgs?: string
  calls: [string, any[]][]
}[] = []

/** Declare a command from anywhere. */
export function command(action: Function, unnamedArgs?: string): Command {
  const calls: [string, any[]][] = []
  commands.push({ action, unnamedArgs, calls })

  return new Proxy({} as any, {
    get:
      (_, key: string, proxy) =>
      (...args: any[]) => {
        calls.push([key, args])
        return proxy
      },
  })
}

/** @internal */
export function useCommands(cli: CAC, actions: Record<string, any>) {
  const entries: [string, Function][] = Object.entries(actions)
    .map(getActionEntries)
    .flat()

  for (const [name, action] of entries) {
    const { unnamedArgs, calls } = commands.find(c => c.action == action)!
    const command: any = cli.command(
      name + (unnamedArgs ? ' ' + unnamedArgs : '')
    )
    for (const [method, args] of calls) {
      command[method].apply(command, args)
    }
    command.action(async (...args: any[]) => {
      try {
        return await action(...args)
      } catch (e: any) {
        // This array of watched files can get large when it exists,
        // to the point where it's basically spam.
        delete e.watchFiles

        if (e.message.startsWith('[saus]')) {
          console.error('\n' + red('✗') + e.message.slice(6))
          process.exit(1)
        }

        throw e
      }
    })
  }
}

function getActionEntries(
  action: [name: string, value: Function | Record<string, any>]
): [string, Function][] {
  if (typeof action[1] == 'function') {
    return [action as any]
  }
  return Object.entries(action[1])
    .sort((a, b) => {
      // Ensure default action is last.
      if (a[0] == 'default') return 1
      if (b[0] == 'default') return -1
      // Otherwise don't care about order.
      return -1
    })
    .map(childAction => {
      childAction[0] =
        childAction[0] !== 'default'
          ? action[0] + ' ' + childAction[0]
          : action[0]

      return getActionEntries(childAction).flat() as [string, Function]
    })
}
