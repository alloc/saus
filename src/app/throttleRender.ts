import type { Route } from '../core/routes'
import { controlExecution } from '../utils/controlExecution'
import { limitConcurrency } from '../utils/limitConcurrency'
import type { ExtractProps, Promisable } from '../utils/types'
import type { ParsedUrl } from '../utils/url'
import type { App } from './createApp'

type RenderFn = (url: ParsedUrl, route: Route, options?: any) => any

type Options<RenderPageKey extends keyof ExtractProps<App, RenderFn>> = {
  /**
   * Which method to override.
   */
  key?: RenderPageKey
  /**
   * Override the default behavior of this plugin, which is to
   * call the `app.loadClientProps` method and assign its result
   * to the `props` option.
   */
  preload?: (app: App, ...args: Parameters<App[RenderPageKey]>) => Promise<void>
  /**
   * Called when an error is thrown while loading the client props
   * of a page. The result is used in lieu of a `renderPage` result.
   */
  onError?: (
    error: any,
    app: App
  ) => Promisable<Awaited<ReturnType<App[RenderPageKey]>>>
}

async function defaultPreload(app: App, url: any, route: any, options: any) {
  options.props = await app.loadClientProps(url, route)
}

/**
 * Limit the number of pages that will be rendered at one time,
 * and prioritize pages whose client props are loaded.
 */
export const throttleRender =
  <RenderPageKey extends keyof ExtractProps<App, RenderFn>>(
    options: Options<RenderPageKey> = {}
  ): App.Plugin =>
  app => {
    const { config } = app
    const { key = 'renderPage', preload = defaultPreload, onError } = options

    // TODO: allow parallel rendering in dev mode?
    const isRenderAllowed = limitConcurrency(
      config.command == 'dev'
        ? 1
        : typeof config.renderConcurrency == 'number'
        ? Math.max(1, config.renderConcurrency)
        : null
    )

    type QueuePageArgs = [any, any, any, Promise<void>]
    type QueuePageResult = Promise<any>

    const queuePage = controlExecution<QueuePageArgs, unknown, QueuePageResult>(
      app[key]
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
      async [key](url: any, route: any, options: any = {}) {
        const loading = preload(app, url, route, options)
        const rendering = queuePage(url, route, options, loading)
        return onError ? rendering.catch(e => onError(e, app)) : rendering
      },
    }
  }
