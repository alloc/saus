import * as vite from 'vite'
import path from 'path'
import cpuCount from 'physical-cpu-count'
import AsyncTaskGroup from 'async-task-group'
import * as RegexParam from 'regexparam'
import { startTask } from 'misty/task'
import {
  createLoader,
  loadConfigHooks,
  loadContext,
  loadRenderHooks,
  loadRoutes,
  resetRenderHooks,
} from './context'
import { Rollup } from './rollup'
import { getPageFilename, Route, RouteParams } from './routes'
import { createPageFactory, RenderedPage } from './render'
import { clientPlugin } from './plugins/client'
import { renderMetaPlugin } from './plugins/renderMeta'
import { routesPlugin } from './plugins/routes'

export type FailedPage = { path: string; reason: string }

export async function build(inlineConfig?: vite.UserConfig) {
  const root = inlineConfig?.root || process.cwd()
  const configEnv: vite.ConfigEnv = {
    command: 'build',
    mode: inlineConfig?.mode || 'production',
  }

  const logLevel = inlineConfig?.logLevel || 'error'
  const context = await loadContext(root, configEnv, logLevel)

  if (inlineConfig)
    context.config = vite.mergeConfig(context.config, inlineConfig)

  let loader = await createLoader(context)
  await loadConfigHooks(context, loader)
  await loader.close()

  context.configHooks.forEach(hook => {
    const result = hook(context.config, context)
    if (result) {
      context.config = vite.mergeConfig(context.config, result)
    }
  })

  context.config.plugins ??= []
  context.config.plugins.unshift(renderMetaPlugin(context))

  loader = await createLoader(context)
  await loadRoutes(context, loader)

  resetRenderHooks(context)
  await loadRenderHooks(context, loader)

  const pageFactory = createPageFactory(context)

  let pageCount = 0
  let renderCount = 0

  const progress = startTask('')
  const updateProgress = () =>
    progress.update(`${renderCount} of ${pageCount} pages rendered`)

  const pages: RenderedPage[] = []
  const errors: FailedPage[] = []

  const pageQueue = new AsyncTaskGroup(
    cpuCount,
    async ([path, renderPage]: [
      string,
      (path: string) => Promise<RenderedPage | null>
    ]) => {
      try {
        const page = await renderPage(path)
        if (page) {
          pages.push(page)
        } else {
          pageCount -= 1
          updateProgress()
        }
      } catch (e: any) {
        console.error(e.stack)
        errors.push({
          path,
          reason: e.message,
        })
      }
      renderCount += 1
      updateProgress()
    }
  )

  const enqueuePage = (
    path: string,
    renderer: (path: string) => Promise<RenderedPage | null>
  ) => {
    pageCount += 1
    updateProgress()
    pageQueue.push([path, renderer])
  }

  // Render the default page.
  if (context.defaultRoute && context.defaultRenderer) {
    enqueuePage('/404', pageFactory.renderUnknownPath)
  }

  const enqueueRoute = (path: string, params: RouteParams, route: Route) =>
    enqueuePage(path, () => pageFactory.renderMatchedPath(path, params, route))

  for (const route of context.routes) {
    if (route.paths) {
      if (!route.keys.length) {
        errors.push({
          path: route.path,
          reason: `Route with "paths" needs a route parameter`,
        })
      } else {
        for (const result of await route.paths()) {
          const values = Array.isArray(result)
            ? (result as (string | number)[])
            : [result]

          const params: RouteParams = {}
          route.keys.forEach((key, i) => {
            params[key] = '' + values[i]
          })

          const path = RegexParam.inject(route.path, params)
          enqueueRoute(path, params, route)
        }
      }
    } else if (!route.keys.length) {
      enqueueRoute(route.path, {}, route)
    }
  }

  await pageQueue
  progress.finish()

  const buildOptions = loader.config.build
  if (buildOptions.write !== false) {
    const routeModulePaths = new Set<string>()
    const pageMap: Record<string, RenderedPage> = {}
    for (const page of pages) {
      const input = getPageFilename(page.path)
      pageMap[input] = page
      routeModulePaths.add(path.join(context.root, page.route.moduleId))
    }

    const routeChunks: { [routeModuleId: string]: Rollup.OutputChunk[] } = {}

    await vite.build(
      vite.mergeConfig(context.config, <vite.UserConfig>{
        build: {
          rollupOptions: { input: Object.keys(pageMap) },
        },
        plugins: [
          clientPlugin(context),
          routesPlugin(context),
          {
            name: 'saus:build',
            enforce: 'post',
            resolveId: id => pageMap[id] && id,
            load(id) {
              const page = pageMap[id]
              return page?.html
            },
            // Deduplicate entry chunks.
            transformIndexHtml(html, ctx) {
              const page = pageMap[ctx.filename]
              if (page.client) {
                const bundle = ctx.bundle!
                const currentChunk = ctx.chunk!
                const routeModuleId = page.route.moduleId
                const existingChunks = routeChunks[routeModuleId] || []
                const duplicateChunk = existingChunks.find(
                  chunk => chunk.code === currentChunk.code
                )

                if (duplicateChunk) {
                  delete bundle[currentChunk.fileName]
                  return html.replace(
                    currentChunk.fileName,
                    duplicateChunk.fileName
                  )
                }

                existingChunks.push(currentChunk)
                routeChunks[routeModuleId] = existingChunks

                // Rename the chunk to avoid confusion. Instead of using the
                // basename of the .html page, use the basename of the route
                // module shared by .html pages with duplicate entry chunk.
                const oldChunkPath = currentChunk.fileName
                const newChunkPath = oldChunkPath.replace(
                  path.basename(ctx.filename, '.html'),
                  path.basename(routeModuleId, path.extname(routeModuleId))
                )

                currentChunk.fileName = newChunkPath
                bundle[newChunkPath] = currentChunk
                delete bundle[oldChunkPath]

                return html.replace(oldChunkPath, currentChunk.fileName)
              }
            },
          },
        ],
      })
    )
  }

  await loader.close()
  return {
    pages,
    errors,
  }
}
