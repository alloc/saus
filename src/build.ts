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
  RegexParam,
  RouteParams,
  SausContext,
  vite,
} from './core'
import { createLoader } from './core/context'
import { setRoutesModule } from './core/global'

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

  const buildOptions = context.config.build || {}
  if (buildOptions.write !== false) {
    const outDir = path.resolve(context.root, buildOptions.outDir || 'dist')
    prepareOutDir(outDir, buildOptions.emptyOutDir, context)
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

async function loadRoutes(context: SausContext) {
  const loader = await createLoader(context, {
    cacheDir: false,
    server: { hmr: false, wss: false, watch: false },
  })
  setRoutesModule(context)
  try {
    await loader.ssrLoadModule(context.routesPath.replace(context.root, ''))
  } finally {
    setRoutesModule(null)
  }
  await loader.close()
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
  let publicDir = context.config.publicDir ?? 'public'
  if (publicDir) {
    publicDir = path.resolve(context.root, publicDir)
    if (fs.existsSync(publicDir)) {
      copyDir(publicDir, outDir)
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

function copyDir(srcDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file)
    if (srcFile === destDir) {
      continue
    }
    const destFile = path.resolve(destDir, file)
    const stat = fs.statSync(srcFile)
    if (stat.isDirectory()) {
      copyDir(srcFile, destFile)
    } else {
      fs.copyFileSync(srcFile, destFile)
    }
  }
}
