import * as vite from 'vite'
import {
  createLoader,
  loadContext,
  loadRenderHooks,
  loadRoutes,
  SausContext,
} from '../core'
import { createPageFactory, PageFactory } from '../pages'
import { renderPlugin } from '../plugins/render'
import { routesPlugin } from '../plugins/routes'

export async function setup(inlineConfig?: vite.UserConfig) {
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

  return [createPageFactory(context), context] as [PageFactory, SausContext]
}
