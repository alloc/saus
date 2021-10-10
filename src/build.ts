import { spawn, ModuleThread, Thread, Worker } from 'threads'
import { startTask } from 'misty/task'
import path from 'path'
import cpuCount from 'physical-cpu-count'
import { vite, BuildOptions, RouteParams } from './core'
import { getPageFilename, RenderedPage } from './pages'
import { clientPlugin } from './plugins/client'
import { routesPlugin } from './plugins/routes'
import { Rollup } from './rollup'
import { rateLimit } from './utils/rateLimit'
import { getCachePath, readCache, writeCache } from './build/cache'
import * as mainWorker from './build/worker'
import { yeux } from './utils/yeux'

export type FailedPage = { path: string; reason: string }

export async function build(
  inlineConfig?: vite.UserConfig & { build?: BuildOptions }
) {
  const context = (await mainWorker.setup(inlineConfig))!

  type PageWorker = typeof import('./build/worker')

  const maxWorkers = Math.max(
    inlineConfig?.build?.maxWorkers ?? cpuCount - 1,
    1
  )

  // HACK: The `spawn` method from "threads" may return the same worker
  // for parallel calls when given the same worker implementation, so
  // we have to prevent parallel calls via queueing.
  const createWorker = rateLimit(1, () =>
    spawn<PageWorker>(new Worker('./build/worker'))
  )

  const workerPool = yeux(async () => {
    const worker = await createWorker()
    await worker.setup(inlineConfig)
    return worker
  })

  // Use the main thread to reduce wait times.
  workerPool.add(mainWorker as any)

  let pageCount = 0
  let renderCount = 0

  const progress = startTask('0 of 0 pages rendered')
  const updateProgress = () =>
    progress.update(`${renderCount} of ${pageCount} pages rendered`)

  const pages: RenderedPage[] = []
  const errors: FailedPage[] = []

  const failedRoutes = new Set<string>()
  const renderPage = rateLimit(
    maxWorkers,
    async (routePath: string, params?: RouteParams) => {
      const worker = await workerPool.get()
      try {
        const page = await worker.renderPage(routePath, params)
        if (page) {
          const filename = getPageFilename(page.path)
          context.pages[filename] = page
          pages.push(page)
        } else {
          pageCount -= 1
          updateProgress()
        }
      } catch (e: any) {
        if (!failedRoutes.has(routePath)) {
          failedRoutes.add(routePath)
          errors.push({
            path: routePath,
            reason: e.stack,
          })
        }
      }
      renderCount += 1
      updateProgress()
      workerPool.add(worker)
    },
    () => {
      pageCount += 1
      updateProgress()
    }
  )

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

          renderPage(route.path, params)
        }
      }
    } else if (!route.keys.length) {
      renderPage(route.path)
    }
  }

  if (context.defaultRoute) {
    renderPage('default')
  }

  await renderPage.calls
  progress.finish()

  // Stop workers from doing unnecessary work after the pages have
  // been generated, but wait to terminate the workers until after
  // the Rollup build is done.
  const terminateQueue: ModuleThread[] = []
  const closing = workerPool.close(async worker => {
    await worker.close()
    if (worker !== mainWorker) {
      terminateQueue.push(worker)
    }
  })

  let buildPromise: Promise<void> | undefined

  const buildOptions = inlineConfig?.build || {}
  if (buildOptions.write !== false && pages.length) {
    const routeModulePaths = new Set<string>()
    const pageMap: Record<string, RenderedPage> = {}
    for (const page of pages) {
      const input = getPageFilename(page.path)
      pageMap[input] = page
      routeModulePaths.add(path.join(context.root, page.routeModuleId))
    }

    const cachePath = getCachePath(context.root)
    let cache = buildOptions.force ? undefined : readCache(cachePath)

    const routeChunks: { [routeModuleId: string]: Rollup.OutputChunk[] } = {}
    const config = vite.mergeConfig(context.config, <vite.UserConfig>{
      build: {
        rollupOptions: { input: Object.keys(pageMap), cache },
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
              const routeModuleId = page.routeModuleId
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

    buildPromise = vite.build(config).then(({ cache }: any) => {
      cache && writeCache(cachePath, cache)
    })
  }

  await Promise.all([
    // Terminate workers while Rollup is building.
    closing.then(() => Promise.all(terminateQueue.map(Thread.terminate))),
    // Wait for Rollup to finish.
    buildPromise,
  ])

  return {
    pages,
    errors,
  }
}
