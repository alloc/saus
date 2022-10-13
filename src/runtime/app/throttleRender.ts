import { controlExecution } from '@utils/controlExecution'
import { limitConcurrency } from '@utils/node/limitConcurrency'
import { noop } from '@utils/noop'
import type { ExtractProps, Promisable } from '@utils/types'
import type { Route } from '../routeTypes'
import type { ParsedUrl } from '../url'
import type { App } from './types'

type RenderFn = (url: ParsedUrl, route: Route, options?: any) => any

type Options<AppRenderMethod extends keyof ExtractProps<App, RenderFn>> = {
  /**
   * Which method to override.
   */
  method?: AppRenderMethod
  /**
   * Override the default behavior of this plugin, which is to
   * call the `app.loadPageProps` method and assign its result
   * to the `props` option.
   */
  preload?: (
    app: App,
    ...args: Parameters<App[AppRenderMethod]>
  ) => Promise<void>
  /**
   * Called when an error is thrown while loading the client props
   * of a page. The result is used in lieu of a `renderPage` result.
   */
  onError?: (
    error: any,
    app: App
  ) => Promisable<Awaited<ReturnType<App[AppRenderMethod]>>>
}

async function defaultPreload(app: App, url: any, route: any, options: any) {
  options.props = await app.loadPageProps(url, route)
}

/**
 * Limit the number of pages that will be rendered at one time,
 * and prioritize pages whose client props are loaded.
 */
export const throttleRender =
  <AppRenderMethod extends keyof ExtractProps<App, RenderFn>>(
    options: Options<AppRenderMethod> = {}
  ): App.Plugin =>
  app => {
    const { config } = app
    const {
      method: key = 'renderPage',
      preload = defaultPreload,
      onError,
    } = options

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
        ctx.execute(args).catch(noop)
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
