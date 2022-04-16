import { Plugin } from './vite'

const kAssocPlugin = Symbol.for('saus.associatedPlugin')

export function associatePlugin<T extends object>(obj: T, plugin?: Plugin) {
  if (plugin)
    Object.defineProperty(obj, kAssocPlugin, {
      value: plugin,
      configurable: true,
    })
}

export function getAssociatedPlugin(obj: object & { [kAssocPlugin]?: Plugin }) {
  return obj[kAssocPlugin]
}
