import { command } from '../../command'

command(sync)

export { sync }

async function sync() {
  const { loadDeployContext } = await import('../../../deploy/context')
  const context = await loadDeployContext()
  await context.syncDeployCache()
}
