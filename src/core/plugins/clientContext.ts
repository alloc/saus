import path from 'path'
import type { ClientConstants } from '../client/context'
import { Plugin } from '../core'
import { clientDir } from '../paths'

const contextModuleId = path.join(clientDir, 'context.ts')

/**
 * Client modules have access to the global `saus` object,
 * which is injected at build time.
 */
export function clientContextPlugin(): Plugin {
  let define: Record<string, string>
  let isBuild: boolean

  return {
    name: 'saus:context:client',
    config(config, env) {
      define = {}
      isBuild = env.command == 'build'

      if (isBuild) {
        define['typeof saus'] = '"object"'
      }

      const sausConfig = config.saus!
      const clientContext: ClientConstants = {
        defaultPath: sausConfig.defaultPath!,
        devRoot: path.resolve(config.root || ''),
        stateModuleBase: sausConfig.stateModuleBase!,
      }
      for (const [key, value] of Object.entries(clientContext)) {
        define['saus.' + key] = JSON.stringify(value)
      }

      if (isBuild)
        return {
          define,
        }
    },
    transform(code, id) {
      if (!isBuild && id == contextModuleId) {
        return (
          code +
          Object.entries(define)
            .map(([key, value]) => key + ' = ' + value)
            .join('\n')
        )
      }
    },
  }
}
