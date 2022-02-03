import { vite } from './vite'

/**
 * The returned `pluginContainer` must have its `close` method called
 * when you're done transforming stuff.
 */
export async function getViteTransform(
  config: vite.ResolvedConfig,
  watch?: boolean
) {
  const context = await vite.createTransformContext(
    config,
    watch && config.server.watch
  )
  return {
    ...context,
    transform: vite.createTransformer(context),
  }
}
