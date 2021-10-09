import {
  createLoader,
  loadContext,
  loadRenderHooks,
  loadRoutes,
  vite,
  ModuleLoader,
  SausContext,
} from '../core'
import { createPageFactory, PageFactory } from '../pages'
import { renderPlugin } from '../plugins/render'
import { routesPlugin } from '../plugins/routes'

export type SetupPromise = Promise<[SausContext, PageFactory, ModuleLoader]>

export async function setup(inlineConfig: vite.UserConfig = {}): SetupPromise {
  const context = await loadContext('build', inlineConfig, [
    renderPlugin,
    routesPlugin,
  ])

  const loader = await createLoader(context, {
    cacheDir: false,
    server: { hmr: false },
  })

  await loadRoutes(context, loader)
  await loadRenderHooks(context, loader)

  return [context, createPageFactory(context), loader]
}
