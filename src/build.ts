import builtinModules from 'builtin-modules'
import fs from 'fs'
import { warn } from 'misty'
import { startTask } from 'misty/task'
import path from 'path'
import { runBundle } from './build/runBundle'
import type { BuildWorker } from './build/worker'
import { printFiles, writePages } from './build/write'
import { bundle } from './bundle'
import type { RenderedPage } from './bundle/types'
import {
  BuildOptions,
  generateRoutePaths,
  RouteParams,
  SausContext,
  vite,
} from './core'
import { loadBundleContext } from './core/bundle'
import { loadRoutes } from './core/loadRoutes'
import { callPlugins } from './utils/callPlugins'
import { emptyDir } from './utils/emptyDir'
import { getPagePath } from './utils/getPagePath'
import { plural } from './utils/plural'

export type FailedPage = { path: string; reason: string }

export async function build(options: BuildOptions) {
  const context = await loadBundleContext(
    { write: false, entry: null, format: 'cjs' },
    { plugins: [setSourcesContent(options)] }
  )

  await loadBuildRoutes(context)

  const bundleFile = 'bundle.js'
  if (options.cached) {
    options.bundlePath = path.join(context.compileCache.path, bundleFile)
  }

  let { code, map } =
    options.bundlePath && fs.existsSync(options.bundlePath)
      ? { code: fs.readFileSync(options.bundlePath, 'utf8'), map: undefined }
      : await bundle(
          { isBuild: true, absoluteSources: true, preferExternal: true },
          context
        )

  const mapFile = bundleFile + '.map'
  if (map) {
    context.compileCache.set(mapFile, JSON.stringify(map))
    code += '\n//# sourceMappingURL=' + mapFile
  }

  const filename = context.compileCache.set(bundleFile, code)
  if (options.bundlePath == filename) {
    context.compileCache.used.add(mapFile)
  }

  const buildOptions = context.config.build
  const outDir = path.resolve(context.root, buildOptions.outDir)

  prepareOutDir(outDir, buildOptions.emptyOutDir, context)
  process.chdir(outDir)

  let render: (pagePath: string) => Promise<RenderedPage | null>
  let worker: BuildWorker | undefined

  if (options.maxWorkers === 0) {
    render = runBundle({ code, filename })
  } else {
    // Tinypool is ESM only, so use dynamic import to load it.
    const dynamicImport = (0, eval)('id => import(id)')
    const WorkerPool = (
      (await dynamicImport('tinypool')) as typeof import('tinypool')
    ).default

    worker = new WorkerPool({
      filename: path.resolve(__dirname, 'build/worker.js'),
      workerData: { code, filename },
      maxThreads: options.maxWorkers,
      idleTimeout: 2000,
    }) as BuildWorker

    render = worker.run.bind(worker)
  }

  let pageCount = 0
  let renderCount = 0

  const progress = startTask('0 of 0 pages rendered')
  const updateProgress = () => {
    progress.update(`${renderCount} of ${pageCount} pages rendered`)
    // Wait for console to update.
    return new Promise(next => process.nextTick(next))
  }

  const pages: RenderedPage[] = []
  const errors: FailedPage[] = []
  const failedRoutes = new Set<string>()

  const renderPage = async (routePath: string, params?: RouteParams) => {
    const pagePath = getPagePath(routePath, params)
    if (options.skip && options.skip(pagePath)) {
      return
    }
    pageCount++
    await updateProgress()
    try {
      const page = await render(context.basePath + pagePath.slice(1))
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

  if (worker) {
    await worker.destroy()
  }

  if (buildOptions.write !== false) {
    await callPlugins(context.plugins, 'onWritePages', pages)
    const files = writePages(pages, outDir)
    printFiles(
      context.logger,
      files,
      vite.normalizePath(path.relative(context.root, outDir)) + '/',
      buildOptions.chunkSizeWarningLimit,
      context.bundle.debugBase
    )
  }

  return {
    pages,
    errors,
  }
}

async function loadBuildRoutes(context: SausContext) {
  const { pluginContainer } = await vite.createTransformContext(context.config)

  const loading = startTask('Loading routes...')
  await loadRoutes(context, {
    resolveId(id, importer) {
      if (builtinModules.includes(id)) {
        return
      }
      return pluginContainer
        .resolveId(id, importer!, { ssr: true })
        .then(resolved => resolved?.id)
    },
  })

  const routeCount = context.routes.length + (context.defaultRoute ? 1 : 0)
  loading.finish(`${plural(routeCount, 'route')} loaded.`)

  await pluginContainer.close()
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
  } else {
    fs.mkdirSync(outDir, { recursive: true })
  }
}

function setSourcesContent(options: BuildOptions): vite.Plugin {
  return {
    name: 'saus:build:sourcesContent',
    generateBundle(_, chunks) {
      for (const chunk of Object.values(chunks)) {
        if (chunk.type == 'chunk' && chunk.map) {
          if (!options.sourcesContent) {
            chunk.map.sourcesContent = []
          } else {
            const sourcesContent = (chunk.map.sourcesContent ||= [])
            chunk.map.sources.forEach((source, i) => {
              try {
                sourcesContent[i] ||= fs.readFileSync(source, 'utf8')
              } catch {}
            })
          }
        }
      }
    },
  }
}
