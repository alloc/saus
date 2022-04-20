import createDebug from 'debug'
import {
  BeforeRenderHook,
  CommonClientProps,
  MergedHtmlProcessor,
  Renderer,
  RenderRequest,
  Route,
  RouteModule,
  RuntimeConfig,
} from '../core'
import { globalCache } from '../runtime/cache'
import { getPageFilename } from '../utils/getPageFilename'
import { limitTime } from '../utils/limitTime'
import { noop } from '../utils/noop'
import { parseHead } from '../utils/parseHead'
import { ParsedUrl } from '../utils/url'
import { headPropsCache, stateModulesMap } from './global'
import {
  ClientPropsLoader,
  ClientResolver,
  PageContext,
  ProfiledEventHandler,
  RenderedPage,
  RenderPageFn,
  RenderPageOptions,
} from './types'

const debug = createDebug('saus:pages')

export function createRenderPageFn(
  config: RuntimeConfig,
  renderers: Renderer[],
  defaultRenderer: Renderer | undefined,
  beforeRenderHooks: BeforeRenderHook[],
  loadClientProps: ClientPropsLoader,
  resolveClient: ClientResolver,
  processHtml: MergedHtmlProcessor | undefined,
  catchRoute: Route | undefined,
  onError: (e: any) => void,
  profile?: ProfiledEventHandler
): RenderPageFn {
  // The main logic for HTML document generation.
  const generateDocument = async (
    url: ParsedUrl,
    props: CommonClientProps,
    route: Route,
    routeModule: RouteModule,
    renderer: Renderer,
    beforeRenderHooks: BeforeRenderHook[]
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

    const usedHooks: BeforeRenderHook[] = []
    for (const hook of beforeRenderHooks) {
      const params = hook.match ? hook.match(path) : {}
      if (params) {
        usedHooks.push(hook)
        await hook({ ...request, params })
      }
    }

    let html = await renderer.renderDocument(request, headPropsCache.get(props))
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
      head: undefined!,
      files: [],
      props,
      routeModuleId: route.moduleId!,
      stateModules: stateModulesMap.get(props) || [],
      client: undefined,
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

    await renderer.onDocument.call(
      {
        emitFile(id, mime, data) {
          if (id !== request.file) {
            page.files.push({ id, mime, data })
          } else {
            page.html = data.toString()
          }
        },
      },
      html,
      request,
      config
    )

    if (page.html) {
      timestamp = Date.now()
      page.client = await resolveClient(renderer, usedHooks)
      if (page.client) {
        globalCache.loaded[page.client.id] = [page.client]
        profile?.('render client', {
          url: url.toString(),
          timestamp,
          duration: Date.now() - timestamp,
        })
      }
      page.head = parseHead(page.html)
    }

    return page
  }

  let pageContextQueue = Promise.resolve()

  async function getPageContext(
    url: ParsedUrl,
    route: Route,
    options: RenderPageOptions
  ): Promise<PageContext> {
    if (!options.setup) {
      return {
        renderers,
        defaultRenderer,
        beforeRenderHooks,
      }
    }
    const pageContext: PageContext = {
      renderers: [],
      beforeRenderHooks: [],
    }
    await options.setup(pageContext, route, url)
    return pageContext
  }

  async function renderErrorPage(
    url: ParsedUrl,
    error: any,
    route: Route,
    options: RenderPageOptions
  ) {
    // @ts-ignore
    url.routeParams.error = error

    const statePromise = loadClientProps(url, route)
    statePromise.catch(noop)

    const contextPromise = pageContextQueue.then(async () => {
      const { defaultRenderer, beforeRenderHooks } = await getPageContext(
        url,
        route,
        options
      )
      if (!defaultRenderer) {
        throw error
      }
      const state = await statePromise
      const routeModule = await route.load()
      return [state, routeModule, defaultRenderer, beforeRenderHooks] as const
    })

    pageContextQueue = contextPromise.then(noop, noop)
    const [state, routeModule, renderer, beforeRenderHooks] =
      await contextPromise

    return generateDocument(
      url,
      state,
      route,
      routeModule,
      renderer,
      beforeRenderHooks
    )
  }

  async function loadPageContext(
    url: ParsedUrl,
    route: Route,
    options: RenderPageOptions
  ) {
    // In SSR mode, multiple pages must not load their modules at the
    // same time, or else they won't be isolated from each other.
    const contextPromise = pageContextQueue.then(async () => {
      const { renderers, defaultRenderer, beforeRenderHooks } =
        await getPageContext(url, route, options)

      let routeModule: RouteModule
      let error: any
      try {
        routeModule = await route.load()
      } catch (e) {
        error = e
      }

      return [
        defaultRenderer,
        renderers,
        error,
        (renderer: Renderer) =>
          generateDocument(
            url,
            options.props || {
              routePath: route.path,
              routeParams: url.routeParams,
            },
            route,
            routeModule,
            renderer,
            beforeRenderHooks
          ),
      ] as const
    })

    pageContextQueue = contextPromise.then(noop, noop)
    return contextPromise
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
    let [defaultRenderer, renderers, error, useRenderer] =
      await loadPageContext(url, route, options)

    let page: RenderedPage | null
    let renderer: Renderer | undefined

    if (!error)
      for (renderer of renderers) {
        if (!renderer.test(url.path)) {
          continue
        }
        try {
          if ((page = await useRenderer(renderer))) {
            return page
          }
        } catch (e) {
          error = e
          break
        }
      }

    if (!error) {
      // Skip requests with file extension, unless explicitly
      // handled by a non-default renderer.
      if (/\.[^/]+$/.test(url.path)) {
        return null
      }
      if (!(renderer = defaultRenderer)) {
        debug(`No matching renderer: %s`, url.path)
        return null
      }
      try {
        if ((page = await useRenderer(renderer))) {
          return page
        }
        return null
      } catch (e) {
        error = e
      }
    }

    if (catchRoute) {
      onError(error)
      try {
        return await renderErrorPage(url, error, catchRoute, options)
      } catch (error: any) {
        error.message =
          'The "error" route could not be rendered: ' + error.message
        throw error
      }
    }

    error.url = url.toString()
    throw error
  }

  return async function renderPage(url, route, options = {}) {
    debug(`Page in progress: %s`, url)

    options.renderStart?.(url)
    const rendering = renderPageOrThrow(url, route, options)
    if (options.renderFinish)
      rendering.then(
        options.renderFinish.bind(null, url, null),
        options.renderFinish.bind(null, url)
      )

    return limitTime(
      rendering,
      options.timeout || 0,
      `Page "${url}" rendering took too long`
    ).then(
      page => [page],
      error => {
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
