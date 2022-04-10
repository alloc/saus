import createDebug from 'debug'
import MagicString, { Bundle as MagicBundle } from 'magic-string'
import md5Hex from 'md5-hex'
import path from 'path'
import type {
  BeforeRenderHook,
  CacheControl,
  Client,
  ClientDescription,
  ClientState,
  Renderer,
  RenderRequest,
  Route,
  RouteModule,
  RouteParams,
  RuntimeConfig,
} from '../core'
import { setRoutesModule } from '../core/global'
import { mergeHtmlProcessors } from '../core/html'
import { matchRoute } from '../core/routes'
import { globalCache } from '../runtime/cache'
import { getCachedState } from '../runtime/getCachedState'
import { controlExecution } from '../utils/controlExecution'
import { getPageFilename } from '../utils/getPageFilename'
import { serializeImports } from '../utils/imports'
import { limitConcurrency } from '../utils/limitConcurrency'
import { limitTime } from '../utils/limitTime'
import { noop } from '../utils/noop'
import { parseHead } from '../utils/parseHead'
import { plural } from '../utils/plural'
import { ParsedUrl, parseUrl } from '../utils/url'
import { handleNestedState } from './handleNestedState'
import { createStateModuleMap } from './stateModules'
import {
  ClientFunction,
  ClientFunctions,
  PageContext,
  RenderedPage,
  RenderFunction,
  RenderPageContext,
  RenderPageFn,
  RenderPageOptions,
} from './types'

const debug = createDebug('saus:pages')

const stateModulesMap = new WeakMap<ClientState, string[]>()
const headPropsCache = new WeakMap<ClientState, Record<string, any>>()

export function createRenderPageFn(
  context: RenderPageContext,
  functions: ClientFunctions,
  config: RuntimeConfig,
  setup?: () => Promise<any>,
  onError: (error: any) => void = context.logger.error
): RenderPageFn {
  let {
    basePath,
    beforeRenderHooks,
    catchRoute,
    defaultRenderer,
    defaultRoute,
    defaultState,
    getCachedPage,
    processHtml,
    profile,
    renderers,
    routes,
  } = context

  // Pages cannot be rendered in parallel, or else we risk inconsistencies
  // caused by global state mutation. This will be fixed in the future with
  // isolated module instances.
  const setupPromise = (async () => {
    if (setup) {
      await setup()
    }
    setRoutesModule(context)
    context.runtimeHooks.forEach(onSetup => {
      try {
        onSetup(config)
      } catch (error: any) {
        onError(error)
      }
    })
    setRoutesModule(null)
    if (context.htmlProcessors) {
      processHtml = mergeHtmlProcessors(
        context.htmlProcessors,
        page => ({ page, config }),
        ['pre', 'default']
      )
    }

    profile = context.profile
    defaultRoute = context.defaultRoute
    defaultState = context.defaultState

    // Routes and renderers are matched in reverse order.
    routes = [...context.routes].reverse()
    renderers.reverse()

    const routeCount = routes.length + (defaultRoute ? 1 : 0)
    const rendererCount = renderers.length + (defaultRenderer ? 1 : 0)
    debug(
      `Page factory has ${plural(routeCount, 'route')} and ${plural(
        rendererCount,
        'renderer'
      )}`
    )
  })()

  // The main logic for HTML document generation.
  async function generateDocument(
    url: ParsedUrl,
    state: ClientState,
    route: Route,
    routeModule: RouteModule,
    renderer: Renderer,
    beforeRenderHooks: BeforeRenderHook[]
  ): Promise<RenderedPage | null> {
    const { path } = url
    const request: RenderRequest = {
      path,
      file: getPageFilename(path, basePath),
      query: url.search,
      params: state.routeParams,
      module: routeModule,
      state,
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

    let html = await renderer.renderDocument(request, headPropsCache.get(state))
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
      state,
      files: [],
      stateModules: stateModulesMap.get(state)!,
      routeModuleId: route.moduleId,
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
      page.client = await getClient(functions, renderer, usedHooks)
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

  // TODO: allow parallel rendering in dev mode?
  const isRenderAllowed = limitConcurrency(
    config.command == 'dev'
      ? 1
      : typeof config.renderConcurrency == 'number'
      ? Math.max(1, config.renderConcurrency)
      : null
  )

  const queuePage = controlExecution(
    (
      pagePath: string,
      statePromise: Promise<ClientState>,
      loader: (cacheControl: CacheControl) => ReturnType<RenderPageFn>
    ) => getCachedPage(pagePath, loader)
  ).with(async (ctx, args, wasQueued) => {
    // The first page to finish loading its state is rendered next…
    await args[1]
    // …as long as not too many pages are currently rendering.
    if (isRenderAllowed(ctx, wasQueued)) {
      ctx.execute(args)
    } else {
      ctx.queuedCalls.push(args)
    }
  })

  const loadClientState = (url: ParsedUrl, route: Route) =>
    getCachedState(url.path, async cacheControl => {
      const timestamp = Date.now()
      const stateModules = createStateModuleMap()
      const routeConfig = route.config ? await route.config(url, route) : route

      // Start loading state modules before the route state is awaited.
      const routeInclude = defaultState.concat([routeConfig.include || []])
      for (const included of routeInclude) {
        stateModules.include(included, url, route)
      }

      const routeState = routeConfig.state
      const clientState: ClientState = (
        typeof routeState == 'function'
          ? await routeState(url, route)
          : { ...routeState }
      ) as any

      clientState.routePath = route.path
      clientState.routeParams = url.routeParams

      // Load any embedded state modules.
      const state = handleNestedState(clientState, stateModules)
      Object.defineProperty(state, '_client', {
        value: clientState,
      })

      // Wait for state modules to load.
      await Promise.all(stateModules.values())
      stateModulesMap.set(state, Array.from(stateModules.keys()))

      profile?.('load state', {
        url: url.toString(),
        timestamp,
        duration: Date.now() - timestamp,
      })

      if (config.command == 'dev')
        Object.defineProperty(state, '_ts', {
          value: Date.now(),
        })

      const { headProps } = routeConfig
      if (headProps) {
        headPropsCache.set(
          state,
          typeof headProps == 'function'
            ? await headProps(url, state)
            : { ...headProps }
        )
      }

      // Reload the page state on almost every request, but keep it
      // cached for `getCachedState` calls that have no loader.
      cacheControl.maxAge = 1

      return state
    })

  let pageContextQueue = Promise.resolve()

  async function getPageContext(
    url: ParsedUrl,
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
    await options.setup(pageContext, url)
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

    const statePromise = loadClientState(url, route)
    statePromise.catch(noop)

    const contextPromise = pageContextQueue.then(async () => {
      const { defaultRenderer, beforeRenderHooks } = await getPageContext(
        url,
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

  function resolveRoute(url: ParsedUrl): [Route?, RouteParams?] {
    let route: Route | undefined
    for (route of routes) {
      const params = matchRoute(url.path, route)
      if (params) {
        return [route, params]
      }
    }
    if ((route = defaultRoute)) {
      return [route]
    }
    return []
  }

  async function loadPageContext(
    url: ParsedUrl,
    route: Route,
    options: RenderPageOptions,
    statePromise: Promise<ClientState>
  ) {
    // In SSR mode, multiple pages must not load their modules at the
    // same time, or else they won't be isolated from each other.
    const contextPromise = pageContextQueue.then(async () => {
      const { renderers, defaultRenderer, beforeRenderHooks } =
        await getPageContext(url, options)

      let routeModule: RouteModule
      let state: ClientState
      let error: any
      try {
        state = await statePromise
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
            state,
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
    options: RenderPageOptions,
    statePromise: Promise<ClientState>
  ) {
    let [defaultRenderer, renderers, error, useRenderer] =
      await loadPageContext(url, route, options, statePromise)

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

  return async function renderPage(url, options = {}) {
    await setupPromise

    if (typeof url == 'string') {
      url = parseUrl(url)
    }

    const cachedPage = getCachedPage(url.path)
    if (cachedPage !== undefined) {
      return cachedPage
    }

    const [route, params] = resolveRoute(url)
    if (!route) {
      return [null]
    }

    // @ts-ignore
    url.routeParams = params || {}

    const pagePath = url.path
    const pageUrl = url

    // State modules can be loaded in parallel, since the global state
    // cache is reused by all pages.
    const statePromise = limitTime(
      loadClientState(url, route),
      options.timeout || 0,
      `Page "${pagePath}" state loading took too long`
    )

    return queuePage(pagePath, statePromise, cacheControl => {
      debug(`Page in progress: %s`, pagePath)

      options.renderStart?.(pagePath)
      const rendering = renderPageOrThrow(pageUrl, route, options, statePromise)
      if (options.renderFinish)
        rendering.then(
          options.renderFinish.bind(null, pagePath, null),
          options.renderFinish.bind(null, pagePath)
        )

      // Rerender the page on every request.
      cacheControl.maxAge = 1

      return limitTime(
        rendering,
        options.timeout || 0,
        `Page "${pagePath}" rendering took too long`
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
    })
  }
}

async function getClient(
  functions: ClientFunctions,
  { client, start }: Renderer,
  usedHooks: BeforeRenderHook[]
): Promise<Client | undefined> {
  if (client) {
    const result = renderClient(
      client,
      functions.render.find(fn => fn.start === start)!,
      functions.beforeRender.filter(fn =>
        usedHooks.some(usedHook => fn.start === usedHook.start)
      )
    )
    const hash = md5Hex(result.code).slice(0, 8)
    const ext = path.extname(functions.filename)
    return {
      id: `client.${hash}${ext}`,
      ...result,
    }
  }
}

function renderClient(
  client: ClientDescription,
  renderFn: RenderFunction,
  beforeRenderFns?: ClientFunction[]
) {
  const script = new MagicBundle()
  const imports = [
    `import { onHydrate as $onHydrate } from "saus/client"`,
    ...serializeImports(client.imports),
  ]

  // The container for top-level statements
  const topLevel = new MagicString(imports.join('\n') + '\n')
  script.addSource(topLevel)

  // The $onHydrate callback
  const onHydrate = new MagicString('')
  script.addSource(onHydrate)

  const importedModules = new Set<string>()
  const insertFunction = (fn: ClientFunction, name: string) => {
    const { function: rawFn, referenced } = fn.transformResult || fn

    for (let stmt of referenced) {
      stmt = stmt.toString()
      if (!importedModules.has(stmt)) {
        importedModules.add(stmt)
        topLevel.append(stmt + '\n')
      }
    }

    topLevel.append(`const ${name} = ${rawFn}`)
    onHydrate.append(
      name == `$render`
        ? `let content = await $render(request.module, request)\n`
        : `${name}(request)\n`
    )
  }

  beforeRenderFns?.forEach((fn, i) => {
    insertFunction(fn, `$beforeRender${i + 1}`)
  })
  insertFunction(renderFn, `$render`)
  onHydrate.append(client.onHydrate)
  if (renderFn.didRender) {
    insertFunction(renderFn.didRender, `$didRender`)
  }

  // Indent the function body, then wrap with $onHydrate call.
  onHydrate.indent('  ')
  onHydrate.prepend(`$onHydrate(async (request) => {\n`)
  onHydrate.append(`\n})`)

  return {
    code: script.toString(),
    map: script.generateMap(),
  }
}
