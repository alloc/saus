import { Plugin } from '../vite'

const order = ['pre', undefined, 'post']

export function upsertPlugin(plugins: Plugin[], plugin: Plugin) {
  let newIndex = -1
  const priority = order.indexOf(plugin.enforce)
  const found = plugins.find((p, i, plugins: any) => {
    if (p.name === plugin.name) {
      plugins[i] = plugin
      return true
    }
    if (newIndex < 0 && priority <= order.indexOf(p.enforce)) {
      newIndex = i
    }
  })
  if (!found) {
    plugins.splice(Math.max(newIndex, 0), 0, plugin)
  }
}
