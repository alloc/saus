import type { ClientConstants } from '@client/context'
import path from 'path'
import { Plugin } from '../core'
import { clientDir } from '../paths'

const contextModuleId = path.join(clientDir, 'context.mjs')

/**
 * Client modules have access to the global `saus` object,
 * which is injected at build time.
 */
export function clientContextPlugin(): Plugin {
  const self: Plugin = {
    name: 'saus:context:client',
    config(config, env) {
      const isBuild = env.command == 'build'
      const sausConfig = config.saus!

      self.transform = (code, id) => {
        if (id == contextModuleId) {
          const clientContext: ClientConstants = {
            defaultPath: sausConfig.defaultPath!,
            devRoot: undefined!,
            stateModuleBase: sausConfig.stateModuleBase!,
          }
          if (!isBuild) {
            clientContext.devRoot = path.resolve(config.root || '')
          }

          code +=
            '\n' +
            Object.entries(clientContext)
              .filter(entry => entry[1] !== undefined)
              .map(([key, value]) => {
                return `context.${key} = ${JSON.stringify(value)}`
              })
              .join('\n') +
            '\n' +
            'Object.freeze(context)'

          return { code, map: null }
        }
      }
    },
  }
  return self
}
