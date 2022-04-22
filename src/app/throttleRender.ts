import type { Route } from '../core/routes'
import { controlExecution } from '../utils/controlExecution'
import { limitConcurrency } from '../utils/limitConcurrency'
import { ParsedUrl } from '../utils/url'
import { App, AppWrapper } from './createApp'
import { RenderPageOptions, RenderPageResult } from './types'

type PreloadFn = (
  app: App,
  url: ParsedUrl,
  route: Route,
  options: RenderPageOptions
) => Promise<void>

export const throttleRender =
  (preload: PreloadFn): AppWrapper =>
  app => {
    const { config, renderPage } = app

    // TODO: allow parallel rendering in dev mode?
    const isRenderAllowed = limitConcurrency(
      config.command == 'dev'
        ? 1
        : typeof config.renderConcurrency == 'number'
        ? Math.max(1, config.renderConcurrency)
        : null
    )

    type QueuePageArgs = [ParsedUrl, Route, RenderPageOptions, Promise<void>]
    type QueuePageResult = Promise<RenderPageResult>

    const queuePage = controlExecution<QueuePageArgs, unknown, QueuePageResult>(
      renderPage
    ).with(async (ctx, args, wasQueued) => {
      // The first page to preload is rendered next…
      await args[3]
      // …as long as not too many pages are currently rendering.
      if (isRenderAllowed(ctx, wasQueued)) {
        ctx.execute(args)
      } else {
        ctx.queuedCalls.push(args)
      }
    })

    return {
      async renderPage(url, route, options = {}) {
        const loading = preload(app, url, route, options)
        return queuePage(url, route, options, loading).catch(error => {
          return [null, error]
        })
      },
    }
  }
