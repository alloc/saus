import { Plugin } from '../core'

/**
 * Client modules have access to the global `saus` object,
 * which is injected at build time.
 */
export function defineClientContext(): Plugin {
  return {
    name: 'saus:client-context',
    config(config) {
      const define: Record<string, string> = {
        'typeof saus': '"object"',
      }
      const sausConfig = config.saus!
      const clientContext = {
        defaultPath: sausConfig.defaultPath,
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
