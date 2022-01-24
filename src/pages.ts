import createDebug from 'debug'
import MagicString, { Bundle as MagicBundle } from 'magic-string'
import md5Hex from 'md5-hex'
import os from 'os'
import path from 'path'
import type {
  BeforeRenderHook,
  Client,
  ClientDescription,
  ClientState,
  RenderApi,
  Renderer,
  RenderRequest,
  Route,
  RouteInclude,
  RouteModule,
  RouteParams,
  RuntimeConfig,
  StateModule,
} from './core'
import { Buffer } from './core/buffer'
import { setRoutesModule } from './core/global'
import { mergeHtmlProcessors } from './core/html'
import { matchRoute } from './core/routes'
import { isStateModule, stateModulesMap } from './core/stateModules'
import { withCache } from './core/withCache'
import {
  ClientFunction,
  ClientFunctions,
  PageContext,
  PageFactoryContext,
  RenderedFile,
  RenderedPage,
  RenderFunction,
  RenderPageOptions,
} from './pages/types'
import { getPageFilename } from './utils/getPageFilename'
import { serializeImports } from './utils/imports'
import { limitConcurrency } from './utils/limitConcurrency'
import { noop } from './utils/noop'
import { parseHead } from './utils/parseHead'
import { ParsedUrl, parseUrl } from './utils/url'

const debug = createDebug('saus:pages')

export type PageFactory = ReturnType<typeof createPageFactory>

export function createPageFactory(
  context: PageFactoryContext,
  functions: ClientFunctions,
  config: RuntimeConfig,
  setup?: () => Promise<any>
) {
  let {
    basePath,
    beforeRenderHooks,
    defaultRoute,
    defaultState,
    logger,
    pages,
    processHtml,
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
        logger.error(error.stack)
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

    defaultRoute = context.defaultRoute
    defaultState = context.defaultState

    // Routes and renderers are matched in reverse order.
    routes = [...context.routes].reverse()
    renderers.reverse()
  })()

  // The main logic for rendering a page.
  async function renderPage(
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

    if (beforeRenderHooks.length) {
      debug(`Running beforeRender hooks`)
    }

    const usedHooks: BeforeRenderHook[] = []
    for (const hook of beforeRenderHooks) {
      const params = hook.match ? hook.match(path) : {}
      if (params) {
        usedHooks.push(hook)
        await hook({ ...request, params })
      }
    }

    debug(`Rendering page: %s`, path)
    let html = await renderer.renderDocument(request)
    if (html == null) {
      debug(`Nothing was rendered. Trying next renderer.`)
      return null
    }

    const page: RenderedPage = {
      path,
      html: '',
      head: undefined,
      state,
      files: [],
      stateModules: stateModulesMap.get(state)!,
      routeModuleId: route.moduleId,
      client: undefined,
    }

    if (processHtml) {
      html = await processHtml(html, page)
    }

    let files: RenderedFile[] = []
    await renderer.onDocument.call(
      {
        emitFile(id, data) {
          if (id !== request.file) {
            files.push({ id, data })
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
      let client = pages[request.file]?.client
      if (!client) {
        debug(`Generating client module`)
        client = await getClient(functions, renderer, usedHooks)
      }
      page.client = client
      page.head = parseHead(page.html)
      pages[request.file] = page
    }

    return page
  }

  type RenderPageFn = (url: ParsedUrl) => Promise<RenderedPage | null>

  const queuePage = limitConcurrency(
    // TODO: allow parallel rendering in dev mode?
    config.command !== 'dev'
      ? Math.max(1, config.renderConcurrency ?? os.cpus().length)
      : 1,
    (url: ParsedUrl, renderPage: RenderPageFn, options: RenderPageOptions) =>
      setupPromise.then(() => {
        debug(`Page in progress: %s`, url)
        options.renderStart?.(url.path)
        const rendering = renderPage(url)
        if (options.renderFinish)
          rendering.then(
            options.renderFinish.bind(null, url.path, null),
            options.renderFinish.bind(null, url.path)
          )
        return rendering
      })
  )

  // Concurrent requests to the same page will use the same promise.
  const loadingPages = new Map<string, Promise<RenderedPage | null>>()

  function loadPage(
    url: string | ParsedUrl,
    options: RenderPageOptions,
    renderPage: RenderPageFn
  ) {
    if (typeof url == 'string') {
      url = parseUrl(url)
    }
    let pagePath = url.path
    let loadingPage = loadingPages.get(pagePath)
    if (!loadingPage) {
      debug(`Page queued: %s`, url)
      loadingPages.set(
        pagePath,
        (loadingPage = queuePage(url, renderPage, options).finally(() => {
          loadingPages.delete(pagePath)
        }))
      )
    }
    return loadingPage
  }

  function loadStateModule(
    loaded: Map<string, Promise<any>>,
    state: StateModule
  ) {
    let loading = loaded.get(state.id)
    if (!loading) {
      loading = state.load().catch(error => {
        logger.error(error.stack)
        return null
      })
      loaded.set(state.id, loading)
    }
    return loading
  }

  function loadStateModules(
    loaded: Map<string, Promise<any>>,
    include: RouteInclude,
    url: ParsedUrl,
    params: RouteParams
  ) {
    const included =
      typeof include == 'function' ? include(url, params) : include

    return included.map(loadStateModule.bind(null, loaded))
  }

  const resolveState = withCache<ClientState>(
    context.loadingStateCache,
    context.loadedStateCache
  )

  const loadPageState = (url: ParsedUrl, params: RouteParams, route: Route) =>
    resolveState(url.path, () => loadClientState(url, params, route))

  async function loadClientState(
    url: ParsedUrl,
    params: RouteParams,
    route: Route
  ) {
    let result: ClientState

    // Start loading state modules before the route state is awaited.
    const pendingStateModules = new Map<string, Promise<any>>()
    for (const include of defaultState.concat([route.include || []])) {
      loadStateModules(pendingStateModules, include, url, params)
    }

    if (route.state) {
      result = (await route.state(
        Object.values(params),
        url.searchParams
      )) as any

      // Load any embedded state modules.
      JSON.stringify(result, (key, state) => {
        if (!isStateModule(state)) {
          return state
        }
        loadStateModule(pendingStateModules, state)
        result[key] = { '@import': state.id }
      })
    } else {
      result = {} as any
    }

    await Promise.all(pendingStateModules.values())
    stateModulesMap.set(result, Array.from(pendingStateModules.keys()))

    result.routePath = route.path
    result.routeParams = params
    return result
  }

  let pageContextQueue = Promise.resolve()

  async function getPageContext(
    url: ParsedUrl,
    options: RenderPageOptions
  ): Promise<PageContext> {
    if (!options.setup) {
      return { renderers, beforeRenderHooks }
    }
    const pageContext: PageContext = {
      renderers: [],
      beforeRenderHooks: [],
    }
    await options.setup(pageContext)
    return pageContext
  }

  async function loadPageContext(
    url: ParsedUrl,
    params: RouteParams,
    route: Route,
    options: RenderPageOptions
  ) {
    // State modules can be loaded in parallel, since the global state
    // cache is reused by all pages.
    const statePromise = loadPageState(url, params, route)

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
          renderPage(
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

  async function renderErrorPage(
    url: ParsedUrl,
    error: any,
    options: RenderPageOptions
  ) {
    const route = defaultRoute
    if (!route) {
      throw error
    }

    const statePromise = loadClientState(url, { error }, route)
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

    return renderPage(
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

  return {
    render: (url: string | ParsedUrl, options: RenderPageOptions = {}) =>
      loadPage(url, options, async url => {
        if (options.preferCache) {
          const filename = getPageFilename(url.path, basePath)
          const cachedPage = pages[filename]
          if (cachedPage) {
            return cachedPage
          }
        }

        const [route, params] = resolveRoute(url)
        if (!route) {
          return null
        }

        let [defaultRenderer, renderers, error, render] = await loadPageContext(
          url,
          params || {},
          route,
          options
        )
        if (!render || !renderers) {
          return null
        }

        let page: RenderedPage | null
        let renderer: Renderer | undefined

        if (!error)
          for (renderer of renderers) {
            if (!renderer.test(url.path)) {
              continue
            }
            try {
              if ((page = await render(renderer))) {
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
            return null
          }
          try {
            if ((page = await render(renderer))) {
              return page
            }
            return null
          } catch (e) {
            error = e
          }
        }

        return renderErrorPage(url, error, options)
      }),
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
        ? `const content = await $render(request.module, request)\n`
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
