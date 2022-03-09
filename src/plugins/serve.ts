import getBody from 'raw-body'
import {
  applyHtmlProcessors,
  extractClientFunctions,
  matchRoute,
  Plugin,
  renderStateModule,
  RuntimeConfig,
  SausContext,
} from '../core'
import { loadRenderers } from '../core/loadRenderers'
import { globalCachePath } from '../core/paths'
import { renderPageState } from '../core/renderPageState'
import { createPageFactory, PageFactory } from '../pages'
import { RenderedFile, RenderPageOptions } from '../pages/types'
import { stateModulesById } from '../runtime/stateModules'
import { globalCache } from '../runtime/cache'
import { getCachedState } from '../runtime/getCachedState'
import { resolveEntryUrl } from '../utils/resolveEntryUrl'
import { resetModule } from '../vm/moduleMap'
import { formatAsyncStack } from '../vm/formatAsyncStack'

export type ServedPage = {
  error?: any
  body?: any
  headers?: [string, string | number][]
}

export const servePlugin = (onError: (e: any) => void) => (): Plugin[] => {
  // The server starts before Saus is ready, so we stall
  // any early page requests until it is.
  let init: PromiseLike<void>
  let didInit: () => void
  init = new Promise(resolve => (didInit = resolve))

  let pageFactory: PageFactory
  let servePage: (url: string) => Promise<ServedPage | undefined>
  let context: SausContext

  function isPageStateRequest(url: string) {
    return url.endsWith('.html.js')
  }
  function isStateModuleRequest(url: string) {
    return url.startsWith('/state/') && url.endsWith('.js')
  }

  const serveState: Plugin = {
    name: 'saus:serveState',
    resolveId(id) {
      return isPageStateRequest(id) || isStateModuleRequest(id) ? id : null
    },
    async load(id) {
      if (isPageStateRequest(id)) {
        await init
        const url = id.replace(/(\/index)?\.html\.js$/, '') || '/'
        const page = await pageFactory.render(url)
        if (page) {
          return renderPageState(
            page,
            context.basePath,
            '@id/saus/src/client/helpers.ts'
          )
        }
      } else if (isStateModuleRequest(id)) {
        await init

        const stateModuleId = id.slice(7, -3)
        await getCachedState(stateModuleId, globalCache.loaders[stateModuleId])

        const stateEntry = globalCache.loaded[stateModuleId]
        if (stateEntry) {
          return renderStateModule(
            stateModuleId,
            stateEntry,
            '/@fs/' + globalCachePath
          )
        }
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST') {
          return next()
        }

        const url = req.url!.slice(context.basePath.length - 1) || '/'
        if (!isStateModuleRequest(url)) {
          return next()
        }

        try {
          const [id, args] = JSON.parse(
            (await getBody(req)).toString('utf8')
          ) as [string, any[]]

          const stateModule = stateModulesById.get(id)
          if (!stateModule) {
            return next()
          }

          await stateModule.load(...args)
          res.writeHead(200)
          res.end()
        } catch (error: any) {
          formatAsyncStack(
            error,
            context.moduleMap!,
            [],
            context.config.filterStack
          )
          console.error(error)
          res.writeHead(500)
          res.end()
        }
      })
    },
  }

  let runtimeConfig: RuntimeConfig
  let fileCache: Record<string, RenderedFile> = {}

  const servePages: Plugin = {
    name: 'saus:servePages',
    saus(c) {
      context = c

      const { config } = c
      runtimeConfig = {
        assetsDir: config.build.assetsDir,
        base: context.basePath,
        command: 'dev',
        defaultPath: context.defaultPath,
        htmlTimeout: config.saus.htmlTimeout,
        minify: false,
        mode: context.config.mode,
        publicDir: config.publicDir,
        ssrRoutesId: '/@fs/' + context.routesPath,
        stateCacheId: '/@fs/' + globalCachePath,
      }
      pageFactory = createPageFactory(
        context,
        extractClientFunctions(context.renderPath),
        runtimeConfig,
        undefined,
        onError
      )
      servePage = context.servePage = createServePageFn(
        context,
        runtimeConfig,
        pageFactory,
        fileCache
      )

      init = {
        // Defer to the reload promise after the context is initialized.
        then: (...args) => (c.reloading || Promise.resolve()).then(...args),
      }
      didInit()
    },
    configureServer: server => () =>
      server.middlewares.use(async (req, res, next) => {
        await init

        let url = req.originalUrl!
        if (!url.startsWith(context.basePath)) {
          return next()
        }

        // Remove URL fragment, but keep querystring
        url = url.replace(/#[^?]*/, '')
        // Remove base path
        url = url.slice(context.basePath.length - 1) || '/'

        if (url in fileCache) {
          const { data, mime } = fileCache[url]
          return respond({
            body: typeof data == 'string' ? data : Buffer.from(data.buffer),
            headers: [['Content-Type', mime]],
          })
        }

        let { reloadId } = context
        await servePage(url).then(respond)

        function respond({ error, body, headers }: ServedPage = {}): any {
          if (reloadId !== (reloadId = context.reloadId)) {
            return (context.reloading || Promise.resolve()).then(() => {
              return servePage(url).then(respond)
            })
          }
          if (error) {
            onError(error)
            res.writeHead(500)
            res.end()
          } else if (body) {
            headers?.forEach(([key, value]) => res.setHeader(key, value))
            res.writeHead(200)
            res.write(body)
            res.end()
          } else {
            next()
          }
        }
      }),
  }

  return [serveState, servePages]
}

function createServePageFn(
  context: SausContext,
  runtimeConfig: RuntimeConfig,
  pageFactory: PageFactory,
  fileCache: Record<string, RenderedFile>
) {
  const { config } = context
  const moduleMap = context.moduleMap!

  const routeModuleIds = new Set(context.routes.map(route => route.moduleId))
  if (context.defaultRoute) {
    routeModuleIds.add(context.defaultRoute.moduleId)
  }

  const entryPaths = Array.from(routeModuleIds, moduleId => {
    return resolveEntryUrl(moduleId, config)
  })
  entryPaths.push(context.renderPath)

  const renderOpts: RenderPageOptions = {
    async setup(pageContext, pageUrl) {
      const route =
        context.routes.find(route => matchRoute(pageUrl.path, route)) ||
        context.defaultRoute
      if (!route) return

      // Reset all modules used by every route or renderer, because we can't know
      // which modules have side effects and are also used by the route matched
      // for the currently rendering page.
      for (const entryPath of entryPaths) {
        const entryModule = moduleMap[entryPath]
        if (entryModule) {
          for (const module of entryModule.package || [entryModule]) {
            resetModule(module)
          }
        }
      }

      // Load the route module and its dependencies now, since the
      // setup function is guaranteed to run serially, which lets us
      // ensure no local modules are shared between page renders.
      await route.load()

      context.renderers = []
      context.defaultRenderer = undefined
      context.beforeRenderHooks = []
      await loadRenderers(context)
      Object.assign(pageContext, context)
    },
  }

  return async (url: string): Promise<ServedPage | undefined> => {
    try {
      let page = await pageFactory.render(url, renderOpts)
      if (!page && !/\.[^./]+$/.test(url)) {
        page = await pageFactory.render(context.defaultPath, renderOpts)
      }
      if (page) {
        for (const file of page.files) {
          fileCache[file.id] = file
        }
        let html = await context.server!.transformIndexHtml(url, page.html)
        if (context.htmlProcessors?.post.length) {
          html = await applyHtmlProcessors(
            html,
            context.htmlProcessors.post,
            { page, config: runtimeConfig },
            runtimeConfig.htmlTimeout
          )
        }
        return {
          body: html,
          headers: [
            ['Content-Type', 'text/html; charset=utf-8'],
            ['Content-Length', Buffer.byteLength(html)],
          ],
        }
      }
    } catch (error) {
      return { error }
    }
  }
}
