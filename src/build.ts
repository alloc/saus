import fs from 'fs'
import { warn } from 'misty'
import { startTask } from 'misty/task'
import path from 'path'
import type { BuildWorker } from './build/worker'
import { printFiles, writePages } from './build/write'
import { bundle, loadBundleContext } from './bundle'
import type { RenderedPage } from './bundle/types'
import {
  BuildOptions,
  generateRoutePaths,
  loadRoutes,
  RegexParam,
  RouteParams,
  SausContext,
  vite,
} from './core'
import { callPlugins } from './utils/callPlugins'

export type FailedPage = { path: string; reason: string }

export async function build(
  inlineConfig?: vite.UserConfig & { build?: BuildOptions }
) {
  const context = await loadBundleContext(inlineConfig)

  const loading = startTask('Loading routes...')
  await loadRoutes(context)

  const routeCount = context.routes.length + (context.defaultRoute ? 1 : 0)
  loading.finish(`${routeCount} routes loaded.`)

  const { code, map } = await bundle(context, {
    write: false,
    entry: null,
    format: 'cjs',
    absoluteSources: true,
  })

  let pageCount = 0
  let renderCount = 0

  const progress = startTask('0 of 0 pages rendered')
  const updateProgress = () => {
    progress.update(`${renderCount} of ${pageCount} pages rendered`)
    // Wait for console to update.
    return new Promise(next => setImmediate(next))
  }

  // Tinypool is ESM only, so use dynamic import to load it.
  const dynamicImport = (0, eval)('id => import(id)')
  const WorkerPool = (
    (await dynamicImport('tinypool')) as typeof import('tinypool')
  ).default

  const buildOptions = context.config.build
  const outDir = path.resolve(context.root, buildOptions.outDir)

  prepareOutDir(outDir, buildOptions.emptyOutDir, context)

  const worker = new WorkerPool({
    filename: path.resolve(__dirname, 'build/worker.js'),
    workerData: { code, map },
    maxThreads: inlineConfig?.build?.maxWorkers,
    idleTimeout: 2000,
  }) as BuildWorker

  const pages: RenderedPage[] = []
  const errors: FailedPage[] = []
  const failedRoutes = new Set<string>()

  const renderPage = async (routePath: string, params?: RouteParams) => {
    pageCount++
    await updateProgress()
    const pageUrl = params ? RegexParam.inject(routePath, params) : routePath
    try {
      const page = await worker.run(context.basePath + pageUrl.slice(1))
      if (page) {
        pages.push(page)
        renderCount++
      } else {
        pageCount--
      }
      await updateProgress()
    } catch (e: any) {
      if (!failedRoutes.has(routePath)) {
        failedRoutes.add(routePath)
        errors.push({
          path: routePath,
          reason: e.stack,
        })
      }
    }
  }

  const promises: Promise<void>[] = []
  await generateRoutePaths(context, {
    path: (routePath, params) => {
      promises.push(renderPage(routePath, params))
    },
    error: e => {
      errors.push(e)
    },
  })

  await Promise.all(promises)
  progress.finish()

  await worker.destroy()

  if (buildOptions.write !== false) {
    await callPlugins(context.plugins, 'onWritePages', pages)
    const files = writePages(pages, outDir)
    printFiles(
      context.logger,
      files,
      vite.normalizePath(path.relative(context.root, outDir)) + '/',
      buildOptions.chunkSizeWarningLimit
    )
  }

  return {
    pages,
    errors,
  }
}

function prepareOutDir(
  outDir: string,
  emptyOutDir: boolean | null | undefined,
  context: SausContext
) {
  if (fs.existsSync(outDir)) {
    if (
      emptyOutDir == null &&
      !vite.normalizePath(outDir).startsWith(context.root + '/')
    ) {
      warn(
        `The \`build.outDir\` will not be emptied, since it exists outside the project root.\n` +
          `Set \`build.emptyOutDir\` to override.`
      )
    } else if (emptyOutDir !== false) {
      emptyDir(outDir, ['.git'])
    }
  }
}

/**
 * Delete every file and subdirectory. **The given directory must exist.**
 * Pass an optional `skip` array to preserve files in the root directory.
 */
function emptyDir(dir: string, skip?: string[]): void {
  for (const file of fs.readdirSync(dir)) {
    if (skip?.includes(file)) {
      continue
    }
    const abs = path.resolve(dir, file)
    // baseline is Node 12 so can't use rmSync :(
    if (fs.lstatSync(abs).isDirectory()) {
      emptyDir(abs)
      fs.rmdirSync(abs)
    } else {
      fs.unlinkSync(abs)
    }
  }
}
