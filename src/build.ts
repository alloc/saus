import fs from 'fs'
import { warn } from 'misty'
import { startTask } from 'misty/task'
import { blue, cyan, dim, gray, green, magenta, yellow } from 'kleur/colors'
import path from 'path'
import type { BuildWorker } from './build/worker'
import { bundle, loadBundleContext } from './bundle'
import { toInlineSourceMap } from './bundle/sourceMap'
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
import { getPageFilename } from './pages'

export type FailedPage = { path: string; reason: string }

export async function build(
  inlineConfig?: vite.UserConfig & { build?: BuildOptions }
) {
  const context = await loadBundleContext(inlineConfig)

  const loading = startTask('Loading routes...')
  await loadRoutes(context)

  const routeCount = context.routes.length + (context.defaultRoute ? 1 : 0)
  loading.finish(`${routeCount} routes loaded.`)

  let { code, map } = await bundle(context, {
    entry: null,
    format: 'cjs',
    write: false,
  })
  code += toInlineSourceMap(map)

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
    workerData: code,
    maxThreads: inlineConfig?.build?.maxWorkers,
  }) as BuildWorker

  const pages = new Map<string, RenderedPage>()
  const errors: FailedPage[] = []
  const failedRoutes = new Set<string>()

  const renderPage = async (routePath: string, params?: RouteParams) => {
    pageCount++
    await updateProgress()
    const pageUrl = params ? RegexParam.inject(routePath, params) : routePath
    try {
      const page = await worker.run(context.basePath + pageUrl.slice(1))
      if (page) {
        const filename = getPageFilename(pageUrl)
        pages.set(filename, page)
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

    const files: Record<string, number> = {}
    const writeFile = (file: string, content: string) => {
      const name = path.relative(outDir, file)
      if (files[name] == null) {
        files[name] = content.length / 1024
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, content)
      }
    }

    for (const [filename, page] of pages) {
      writeFile(path.join(outDir, filename), page.html)
      for (const module of [...page.modules, ...page.assets]) {
        writeFile(path.join(outDir, module.id), module.text)
      }
    }

    printFiles(
      context.logger,
      files,
      vite.normalizePath(path.relative(context.root, outDir)) + '/',
      buildOptions.chunkSizeWarningLimit ?? 500
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

type Color = typeof green
const writeColors: Record<string, Color> = {
  '.js': cyan,
  '.css': magenta,
  '.html': blue,
  '.map': gray,
}

function printFiles(
  logger: vite.Logger,
  files: Record<string, number>,
  outDir: string,
  chunkLimit: number
) {
  const maxLength = Object.keys(files).reduce(
    (maxLength, file) => Math.max(maxLength, file.length),
    0
  )
  for (const [file, kibs] of Object.entries(files)) {
    const color = writeColors[path.extname(file)] || green
    const fileName = gray(outDir) + color(file.padEnd(maxLength + 2))
    const fileSize = (kibs > chunkLimit ? yellow : dim)(
      `${kibs.toFixed(2)} KiB`
    )
    logger.info(fileName + ' ' + fileSize)
  }
}
