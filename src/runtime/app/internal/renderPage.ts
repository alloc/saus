import { limitTime } from '@utils/limitTime'
import { noop } from '@utils/noop'
import { parseHead } from '@utils/parseHead'
import { unwrapDefault } from '@utils/unwrapDefault'
import createDebug from 'debug'
import { Promisable } from 'type-fest'
import { RouteLayout } from '../../layouts'
import { RenderRequest } from '../../renderer'
import { renderHtml } from '../../renderHtml'
import { Route, RouteModule } from '../../routeTypes'
import { ParsedUrl } from '../../url'
import {
  AnyServerProps,
  App,
  RenderedPage,
  RenderPageFn,
  RenderPageOptions,
  RenderPageResult,
} from '../types'

const debug = createDebug('saus:pages')

export function getPageFactory(app: App, ctx: App.Context): RenderPageFn {
  const { config } = app
  const { onError, profile } = ctx

  // The main logic for HTML document generation.
  const renderRouteLayout = async (
    url: ParsedUrl,
    props: AnyServerProps,
    route: Route,
    routeModule: RouteModule,
    routeLayout: RouteLayout
  ): Promise<RenderedPage | null> => {
    const { path } = url
    const request: RenderRequest = {
      path,
      query: url.search,
      params: url.routeParams,
      module: routeModule,
      props,
    }

    let timestamp = Date.now()

    let html = await renderHtml(routeLayout, request, props._headProps)
    if (html == null) {
      return null
    }

    profile?.('render html', {
      url: url.toString(),
      timestamp,
      duration: Date.now() - timestamp,
    })

    const page: RenderedPage = {
      path,
      route,
      props,
      html: '',
      head: null!,
      files: [],
    }

    if (app.preProcessHtml) {
      timestamp = Date.now()
      html = await app.preProcessHtml(html, page, config.htmlTimeout)
      profile?.('process html', {
        url: url.toString(),
        timestamp,
        duration: Date.now() - timestamp,
      })
    }

    if (html) {
      page.html = html
      page.head = parseHead(page.html)
    }

    return page
  }

  let pageContextQueue = Promise.resolve()

  const loadRouteLayout = async (route: Route) => {
    let layoutModule: any
    if (typeof route.layout == 'function') {
      debug('Loading route layout')
      layoutModule = await route.layout()
    } else {
      const layoutEntry = route.layoutEntry || config.defaultLayout.id
      debug('Loading route layout: %s', layoutEntry)
      layoutModule = await ctx.ssrRequire(layoutEntry)
    }
    return unwrapDefault<RouteLayout>(layoutModule)
  }

  async function renderErrorPage(
    url: ParsedUrl,
    error: any,
    route: Route,
    options: RenderPageOptions
  ) {
    // @ts-ignore
    url.routeParams.error = error

    const promisedProps = app.loadPageProps(url, route)
    promisedProps.catch(noop)

    let props!: AnyServerProps
    let routeModule!: RouteModule
    let routeLayout!: RouteLayout

    await (pageContextQueue = pageContextQueue.then(async () => {
      if (options.setup) {
        await options.setup(route, url)
      }
      try {
        props = await promisedProps
        props.error = error
        debug('Loading route module: %s', route.path)
        routeModule = await route.load()
        routeLayout = await loadRouteLayout(route)
        error = undefined
      } catch (e) {
        error = e
      }
    }))

    if (error) {
      error.message = 'The "error" route failed to render: ' + error.message
      throw error
    }

    return renderRouteLayout(url, props, route, routeModule, routeLayout)
  }

  /**
   * Load the page context for the given URL, find a suitable renderer,
   * and render the page with it. The catch route will be used if an
   * error if thrown by a renderer. If no catch route is defined, the
   * error is rethrown.
   */
  async function renderPageOrThrow(
    url: ParsedUrl,
    route: Route,
    options: RenderPageOptions
  ) {
    let error: any
    let routeModule!: RouteModule
    let routeLayout!: RouteLayout

    // In SSR mode, multiple pages must not load their modules at the
    // same time, or else they won't be isolated from each other.
    await (pageContextQueue = pageContextQueue.then(async () => {
      if (options.setup) {
        await options.setup(route, url)
      }
      try {
        debug('Loading route module: %s', route.path)
        routeModule = await route.load()
        routeLayout = await loadRouteLayout(route)
      } catch (e) {
        error = e
      }
    }))

    if (!error) {
      try {
        const props = options.props || (await app.loadPageProps(url, route))
        return await renderRouteLayout(
          url,
          props,
          route,
          routeModule,
          routeLayout
        )
      } catch (e) {
        error = e
      }
    }

    if (ctx.catchRoute) {
      onError(error)
      return await renderErrorPage(url, error, ctx.catchRoute, options)
    }

    error.url = url.toString()
    throw error
  }

  return async function renderPage(
    url,
    route,
    options = {}
  ): Promise<RenderPageResult> {
    debug(`Page in progress: %s (matching "%s" route)`, url, route.path)
    if (route !== options.defaultRoute) {
      options.renderStart?.(url)
    }
    return limitTime(
      renderPageOrThrow(url, route, options),
      options.timeout || 0,
      `Page "${url}" rendering took too long`
    )
      .then((page): Promisable<RenderPageResult> => {
        if (!page) {
          if (options.defaultRoute) {
            debug(`Falling back to default route: %s`, url)
            const { defaultRoute, ...rest } = options
            return renderPage(url, defaultRoute, rest)
          }
          debug(`No page was generated: %s`, url)
        }
        options.renderFinish?.(url, null, page)
        return [page]
      })
      .catch((error: any): RenderPageResult => {
        debug(`Page failed to render: %s`, url)
        options.renderFinish?.(url, error)
        if (options.onError) {
          options.onError(error)
        } else {
          onError(error)
        }
        return [null, error]
      })
  }
}
