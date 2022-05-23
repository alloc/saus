import type { RuntimeConfig } from '../core/config'
import { controlExecution } from '../utils/controlExecution'
import { limitConcurrency } from '../utils/limitConcurrency'
import type { Promisable } from '../utils/types'
import type { ClientPropsLoader } from './types'

type App = {
  config: RuntimeConfig
  loadClientProps: ClientPropsLoader
  // The `throttleRender` plugin works with the base App type
  // and the BundledApp type, so the renderPage method needs
  // a less strict type signature.
  renderPage: (url: any, route: any, options: any) => any
}

type Options<T extends App> = {
  /**
   * Override the default behavior of this plugin, which is to
   * call the `app.loadClientProps` method and assign its result
   * to the `props` option.
   */
  preload?: (
    app: T,
    url: Parameters<T['renderPage']>[0],
    route: Parameters<T['renderPage']>[1],
    options: Exclude<Parameters<T['renderPage']>[2], void>
  ) => Promise<void>
  /**
   * Called when an error is thrown while loading the client props
   * of a page. The result is used in lieu of a `renderPage` result.
   */
  onError?: (
    error: any,
    app: T
  ) => Promisable<Awaited<ReturnType<T['renderPage']>>>
}

async function defaultPreload(app: App, url: any, route: any, options: any) {
  options.props = await app.loadClientProps(url, route)
}

/**
 * Limit the number of pages that will be rendered at one time,
 * and prioritize pages whose client props are loaded.
 */
export const throttleRender =
  <T extends App>(options: Options<T> = {}) =>
  (app: T) => {
    const { preload = defaultPreload, onError } = options
    const { config, renderPage } = app

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
      renderPage
    ).with(async (ctx, args, wasQueued) => {
      // The first page to preload is rendered next…
      await args[args.length - 1]
      // …as long as not too many pages are currently rendering.
      if (isRenderAllowed(ctx, wasQueued)) {
        ctx.execute(args)
      } else {
        ctx.queuedCalls.push(args)
      }
    })

    return {
      async renderPage(url: any, route: any, options: any = {}) {
        const loading = preload(app, url, route, options)
        const rendering = queuePage(url, route, options, loading)
        return onError ? rendering.catch(e => onError(e, app)) : rendering
      },
    }
  }
