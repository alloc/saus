import { ClientState } from '../client'
import type { Route } from '../core/routes'
import { controlExecution } from '../utils/controlExecution'
import { limitConcurrency } from '../utils/limitConcurrency'
import { ParsedUrl } from '../utils/url'
import { AppWrapper } from './createApp'
import { RenderPageOptions, RenderPageResult } from './types'

export const throttleRender: AppWrapper = app => {
  const { config, renderPage } = app

  // TODO: allow parallel rendering in dev mode?
  const isRenderAllowed = limitConcurrency(
    config.command == 'dev'
      ? 1
      : typeof config.renderConcurrency == 'number'
      ? Math.max(1, config.renderConcurrency)
      : null
  )

  type QueuePageResult = Promise<RenderPageResult>
  type QueuePageArgs = [
    ParsedUrl,
    Route,
    RenderPageOptions | undefined,
    Promise<ClientState>
  ]

  const queuePage = controlExecution<QueuePageArgs, unknown, QueuePageResult>(
    renderPage
  ).with(async (ctx, args, wasQueued) => {
    // The first page to finish loading its state is rendered next…
    await args[3]
    // …as long as not too many pages are currently rendering.
    if (isRenderAllowed(ctx, wasQueued)) {
      ctx.execute(args)
    } else {
      ctx.queuedCalls.push(args)
    }
  })

  return {
    async renderPage(url, route, options) {
      const state = app.loadClientState(url, route)
      return queuePage(url, route, options, state)
    },
  }
}
