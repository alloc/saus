import path from 'path'
import type { ClientConstants } from '../client/context'
import { Plugin } from '../core'

/**
 * Client modules have access to the global `saus` object,
 * which is injected at build time.
 */
export function defineClientContext(): Plugin {
  return {
    name: 'saus:client-context',
    config(config, env) {
      const define: Record<string, string> = {}

      if (env.command == 'build') {
        define['typeof saus'] = '"object"'
      }

      const sausConfig = config.saus!
      const clientContext: ClientConstants = {
        defaultPath: sausConfig.defaultPath!,
        devRoot: path.resolve(config.root || ''),
      }
      for (const [key, value] of Object.entries(clientContext)) {
        define['saus.' + key] = JSON.stringify(value)
      }

      return {
        define,
      }
    },
  }
}
