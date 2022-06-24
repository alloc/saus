import { vite } from '../vite'

/**
 * The returned `pluginContainer` must have its `close` method called
 * when you're done transforming stuff.
 *
 * File watching is disabled by default.
 */
export async function getViteTransform(
  config: vite.ResolvedConfig,
  watch?: boolean
) {
  const context = await vite.createTransformContext(
    config,
    watch ? config.server.watch : false
  )
  return {
    ...context,
    transform: vite.createTransformer(context),
  }
}
