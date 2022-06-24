import { App } from '@/app/types'
import { loadContext } from '@/context'
import type { Endpoint } from '@/core'
import { getRequireFunctions } from '@/getRequireFunctions'
import { getSausPlugins } from '@/getSausPlugins'
import { loadRenderers } from '@/loadRenderers'
import { loadRoutes } from '@/loadRoutes'
import { clientDir, runtimeDir } from '@/paths'
import { defineClientContext } from '@/plugins/clientContext'
import { getClientUrl, serveClientEntries } from '@/plugins/clientEntries'
import { transformClientState } from '@/plugins/clientState'
import { moduleRedirection, redirectModule } from '@/plugins/moduleRedirection'
import { renderPlugin } from '@/plugins/render'
import { routesPlugin } from '@/plugins/routes'
import { servePlugin } from '@/plugins/serve'
import { prependBase } from '@/utils/base'
import { callPlugins } from '@/utils/callPlugins'
import { defer } from '@/utils/defer'
import { getPageFilename } from '@/utils/getPageFilename'
import { vite } from '@/vite'
import { getViteFunctions } from '@/vite/functions'
import { formatAsyncStack } from '@/vm/formatAsyncStack'
import { createFullReload } from '@/vm/fullReload'
import { injectNodeModule } from '@/vm/nodeModules'
import { ModuleMap } from '@/vm/types'
import { addExitCallback, removeExitCallback } from 'catch-exit'
import { EventEmitter } from 'events'
import http from 'http'
import { bold, gray, green, red } from 'kleur/colors'
import path from 'path'
import { debounce } from 'ts-debounce'
import { inspect } from 'util'
import { DevContext } from './context'
import { createDevApp } from './createDevApp'
import { DevEventEmitter } from './events'
import { createHotReload } from './hotReload'

export interface SausDevServer {
  (req: http.IncomingMessage, res: http.ServerResponse, next?: () => void): void

  events: DevEventEmitter
  restart(): void
  close(): Promise<void>
}

export async function createServer(
  inlineConfig?: vite.UserConfig
): Promise<SausDevServer> {
  const events: DevEventEmitter = new EventEmitter()
  const createContext = () =>
    loadContext<DevContext>('serve', inlineConfig, [
      servePlugin(e => events.emit('error', e)),
      serveClientEntries,
      routesPlugin(),
      renderPlugin,
      defineClientContext,
      transformClientState,
      () =>
        moduleRedirection([
          redirectModule(
            path.join(runtimeDir, 'loadStateModule.ts'),
            path.join(clientDir, 'loadStateModule.ts')
          ),
        ]),
    ])

  let context = await createContext()
  let moduleMap: ModuleMap = {}

  events.on('error', onError)
  events.on('restart', restart)

  let server: vite.ViteDevServer | null = null
  let serverPromise = startServer(context, moduleMap, events)

  // Stop promises from crashing the process.
  process.on('unhandledRejection', onError)

  function restart() {
    serverPromise = serverPromise.then(async oldServer => {
      try {
        await oldServer?.close()
      } catch {}

      context.logger.clearScreen('info')
      context = await createContext()
      server = await startServer(context, (moduleMap = {}), events, true)
      return server
    })
    serverPromise.catch(onError)
  }

  function onError(error: any) {
    if (error.code == 'EADDRINUSE') return
    const { logger } = context
    if (!logger.hasErrorLogged(error)) {
      formatAsyncStack(error, moduleMap, [], context.config.filterStack)
      logger.error(formatError(error, context.app), { error })
    }
  }

  server = await serverPromise

  const onExit = addExitCallback((signal, exitCode, error) => {
    if (error) {
      formatAsyncStack(error, moduleMap, [], context.config.filterStack)
    }
  })

  function middleware(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next?: () => void
  ): void {
    serverPromise.then(server => {
      if (server) {
        server.middlewares(req, res, next)
      } else if (next) {
        next()
      }
    }, next)
  }

  middleware.events = events
  middleware.restart = restart
  middleware.close = async () => {
    process.off('unhandledRejection', onError)
    events.emit('close')
    try {
      const server = await serverPromise
      await server?.close()
    } catch (e) {
      onError(e)
    } finally {
      removeExitCallback(onExit)
    }
  }

  return middleware
}

async function startServer(
  context: DevContext,
  moduleMap: ModuleMap,
  events: DevEventEmitter,
  isRestart?: boolean
) {
  const { config, logger } = context
  const server = await vite.createServer(config)

  // Listen immediately to ensure `buildStart` hook is called.
  if (server.httpServer) {
    await listen(server, events, isRestart)

    if (logger.isLogged('info')) {
      logger.info('')
      server.printUrls()
      server.bindShortcuts()
      logger.info('')
    }
  }

  // Ensure the Vite config is watched.
  const watcher = server.watcher!
  if (context.configPath) {
    watcher.add(context.configPath)
  }

  context.events = events
  context.server = server
  context.watcher = watcher
  context.moduleMap = moduleMap
  context.externalExports = new Map()
  context.linkedModules = {}
  context.liveModulePaths = new Set()
  context.pageSetupHooks = []
  Object.assign(context, getViteFunctions(server.pluginContainer))
  Object.assign(context, getRequireFunctions(context))
  setupClientInjections(context)

  // Force all node_modules to be reloaded
  context.ssrForceReload = createFullReload()
  context.plugins = await getSausPlugins(context, config)
  try {
    await loadRoutes(context)
    context.logger.info(green('✔︎ Routes are ready!'))
    await loadRenderers(context)
    context.logger.info(green('✔︎ Renderers are ready!'))
  } catch (e: any) {
    events.emit('error', e)
  }
  context.ssrForceReload = undefined

  await prepareDevApp(context)
  watcher.prependListener('change', context.hotReload)

  // Use process.nextTick to ensure whoever is awaiting the `createServer`
  // call can handle this event.
  process.nextTick(() => {
    events.emit('listening')
  })

  return server
}

function listen(
  server: vite.ViteDevServer,
  events: DevEventEmitter,
  isRestart?: boolean
): Promise<void> {
  let listening = false

  const { resolve, promise } = defer<void>()
  events.once('close', () => resolve())

  // When optimizing deps, a syntax error may be hit. If so, we need to
  // handle it here by waiting for the offending file to be updated, and
  // try to optimize again once updated.
  server.httpServer!.on('error', (error: any) => {
    events.emit('error', error)

    // ESBuild syntax errors have an "errors" array property.
    if (!listening && Array.isArray(error.errors)) {
      const files = new Set<string>()
      error.errors.forEach((e: any) => {
        const file = e.location?.file
        if (file && typeof file == 'string') {
          files.add(path.resolve(server.config.root, file))
        }
      })
      if (files.size) {
        waitForChanges(files, server, events, listen)
      }
    }
  })

  const listen = async () => {
    try {
      if (await server.listen(undefined, isRestart)) {
        listening = true
        resolve()
      }
    } catch {}
  }

  listen()
  return promise
}

function waitForChanges(
  input: string | Set<string>,
  server: vite.ViteDevServer,
  events: DevEventEmitter,
  callback: () => void
) {
  const { logger } = server.config
  const watcher = server.watcher!

  const files = typeof input === 'string' ? new Set([input]) : input
  const onChange = (file: string) => {
    if (files.has(file)) {
      watcher.off('change', onChange)
      events.off('close', onClose)

      logger.clearScreen('info')
      callback()
    }
  }

  const onClose = () => {
    watcher.off('change', onChange)
  }

  watcher.on('change', onChange)
  events.on('close', onClose)

  logger.info('\n' + gray('Waiting for changes...'))
}

async function prepareDevApp(context: DevContext) {
  const { server, watcher, events } = context
  const failedRequests = new Set<Endpoint.Request>()

  await resetDevApp()
  async function resetDevApp() {
    context.app = await createDevApp(context, error => {
      if (error.req) {
        failedRequests.add(error.req)
      }
      events.emit('error', error)
    })
    await callPlugins(context.plugins, 'receiveDevApp', context.app)
  }

  context.hotReload = createHotReload(context, {
    schedule: debounce(reload => reload(), 50),
    async start({ routesChanged, renderersChanged, clientEntriesChanged }) {
      const clientChanges = new Set<string>()

      return {
        clientChange(url) {
          clientChanges.add(url)
        },
        async finish() {
          let pendingPages: Promise<void> | undefined
          if (routesChanged || renderersChanged) {
            pendingPages = context.forCachedPages((pagePath, [page]) => {
              // Emit change events for page state modules.
              if (routesChanged) {
                const filename = getPageFilename(pagePath, context.basePath)
                clientChanges.add('/' + filename + '.js')
              }
              // Ensure the generated clients are updated.
              if (renderersChanged && clientEntriesChanged && page?.client) {
                clientChanges.add('\0' + getClientUrl(page.client.id, '/'))
              }
            })
            context.clearCachedPages()
            await resetDevApp()
          }

          // Emit watcher events after the reload promise is resolved.
          queueMicrotask(async () => {
            await pendingPages
            for (const url of clientChanges) {
              watcher.emit('change', url)
            }
            const reloadedPages = Array.from(failedRequests, req => req.path)
            failedRequests.clear()
            reloadedPages.forEach(pagePath => {
              server.ws?.send({
                type: 'full-reload',
                path: pagePath,
              })
            })
          })
        },
      }
    },
  })
}

// Some "saus/client" exports depend on project config.
function setupClientInjections(context: DevContext) {
  const modulePath = path.resolve(__dirname, '../client/baseUrl.cjs')
  context.liveModulePaths.add(modulePath)
  context.liveModulePaths.add(
    // This module re-exports us, so it's also live.
    path.resolve(modulePath, '../index.cjs')
  )
  context.pageSetupHooks.push(() => {
    const { config } = context
    injectNodeModule(modulePath, {
      BASE_URL: config.base,
      isDebug: config.mode !== 'production',
      prependBase(uri: string, base = config.base) {
        return prependBase(uri, base)
      },
    })
    return context.hotReload(modulePath)
  })
}

function formatError(error: any, app: App) {
  let prelude = ''
  if (error.code == 'STATE_MODULE_404') {
    const moduleUrl = app.config.stateModuleBase + error.cacheKey + '.js'
    const inspectedArgs = inspect(error.args, {
      depth: 5,
      colors: true,
    })
    prelude =
      red(bold('Error: ')) +
      `The ${red(moduleUrl)} module was ` +
      `never loaded with the following arguments:\n` +
      inspectedArgs.replace(/(^|\n)/g, '$1  ') +
      `\n\n`
  }
  return '\n' + prelude + error.stack
}
