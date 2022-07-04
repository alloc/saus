import { RouteLayout } from '@/runtime/layouts'
import createDebug from 'debug'
import type {
  CommonClientProps,
  MergedHtmlProcessor,
  RenderRequest,
  Route,
  RouteModule,
  RuntimeConfig,
} from '../core'
import { ParsedUrl } from '../node/url'
import { getPageFilename } from '../utils/getPageFilename'
import { limitTime } from '../utils/limitTime'
import { noop } from '../utils/noop'
import { parseHead } from '../utils/parseHead'
import { unwrapDefault } from '../utils/unwrapDefault'
import { headPropsCache, stateModulesMap } from './global'
import { renderHtml } from './renderHtml'
import {
  ClientPropsLoader,
  ProfiledEventHandler,
  RenderedPage,
  RenderPageFn,
  RenderPageOptions,
  RenderPageResult,
} from './types'

const debug = createDebug('saus:pages')

export function createRenderPageFn(
  config: RuntimeConfig,
  ssrImport: <T = any>(id: string) => Promise<T>,
  loadClientProps: ClientPropsLoader,
  processHtml: MergedHtmlProcessor | undefined,
  catchRoute: Route | undefined,
  onError: (e: any) => void,
  profile?: ProfiledEventHandler
): RenderPageFn {
  // The main logic for HTML document generation.
  const renderRouteLayout = async (
    url: ParsedUrl,
    props: CommonClientProps,
    route: Route,
    routeModule: RouteModule,
    routeLayout: RouteLayout
  ): Promise<RenderedPage | null> => {
    const { path } = url
    const request: RenderRequest = {
      path,
      file: getPageFilename(path, config.base),
      query: url.search,
      params: url.routeParams,
      module: routeModule,
      props,
    }

    let timestamp = Date.now()

    let html = await renderHtml(routeLayout, request, headPropsCache.get(props))
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
      html: '',
      head: null!,
      files: [],
      props,
      route,
      stateModules: stateModulesMap.get(props) || [],
    }

    if (processHtml) {
      timestamp = Date.now()
      html = await processHtml(html, page, config.htmlTimeout)
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
      layoutModule = await route.layout()
    } else {
      const layoutEntry = route.layoutEntry || config.defaultLayout.id
      layoutModule = await ssrImport(layoutEntry)
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

    const promisedProps = loadClientProps(url, route)
    promisedProps.catch(noop)

    let props!: CommonClientProps
    let routeModule!: RouteModule
    let routeLayout!: RouteLayout

    await (pageContextQueue = pageContextQueue.then(async () => {
      if (options.setup) {
        await options.setup(route, url)
      }
      try {
        props = await promisedProps
        props.error = error
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
        routeModule = await route.load()
        routeLayout = await loadRouteLayout(route)
      } catch (e) {
        error = e
      }
    }))

    if (!error) {
      const props = options.props || {
        routePath: route.path,
        routeParams: url.routeParams,
      }
      try {
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

    if (catchRoute) {
      onError(error)
      return await renderErrorPage(url, error, catchRoute, options)
    }

    error.url = url.toString()
    throw error
  }

  return async function renderPage(
    url,
    route,
    options = {}
  ): Promise<RenderPageResult> {
    options.props ||= await loadClientProps(url, route)
    debug(`Page in progress: %s`, url)
    if (route !== options.defaultRoute) {
      options.renderStart?.(url)
    }
    return limitTime(
      renderPageOrThrow(url, route, options),
      options.timeout || 0,
      `Page "${url}" rendering took too long`
    ).then(
      page => {
        if (!page && options.defaultRoute) {
          const { defaultRoute, ...rest } = options
          return renderPage(url, defaultRoute, rest)
        }
        options.renderFinish?.(url, null, page)
        return [page]
      },
      error => {
        options.renderFinish?.(url, error)
        if (options.onError) {
          options.onError(error)
        } else {
          onError(error)
        }
        return [null, error]
      }
    )
  }
}
