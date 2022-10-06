import { toArray } from '@/utils/array'
import chokidar from 'chokidar'
import * as convertSourceMap from 'convert-source-map'
import * as esbuild from 'esbuild'
import toGlobBase from 'glob-base'
import { Module } from 'module'
import path from 'path'
import { crawl } from 'recrawl-sync'
import { CompileCache } from '../node/compileCache'
import { resolveMapSources, toInlineSourceMap } from '../node/sourceMap'
import { isPackageRef } from '../utils/isPackageRef'
import { vite } from '../vite'
import {
  compileEsm,
  importAsyncId,
  importMetaId,
  requireAsyncId,
} from '../vm/compileEsm'
import { ImporterSet } from '../vm/ImporterSet'
import { isLiveModule } from '../vm/isLiveModule'
import { ModuleMap } from '../vm/moduleMap'
import { CompiledModule, RequireAsync, Script } from '../vm/types'
import { overwriteScript } from './overwriteScript'

/**
 * Compile an ES module from `node_modules` into a CJS module.
 * The module can be in any language supported by Esbuild.
 */
export async function compileNodeModule(
  code: string,
  filename: string,
  requireAsync: RequireAsync,
  {
    compileCache,
    importMeta,
    liveModulePaths,
    moduleMap,
    watcher,
  }: {
    compileCache?: CompileCache | null
    importMeta?: Record<string, any>
    liveModulePaths?: Set<string>
    moduleMap?: ModuleMap
    watcher?: vite.FSWatcher
  } = {}
): Promise<CompiledModule> {
  const time = Date.now()
  const env: Record<string, any> = {
    require: Module.createRequire(filename),
    __dirname: path.dirname(filename),
    __filename: filename,
    [importMetaId]: {
      env: { ...importMeta, SSR: true },
      glob: (globs: string | string[]) =>
        lazyGlobRequire(toArray(globs), filename, requireAsync, watcher),
    },
    [importAsyncId]: (id: string) => requireAsync(id, filename, true),
    [requireAsyncId]: (id: string) => requireAsync(id, filename, false),
  }

  let cacheKey = ''
  let cached: string | undefined

  if (compileCache && filename[0] !== '\0') {
    cacheKey = compileCache.key(code, 'node/' + path.basename(filename))
    cached = compileCache.get(cacheKey, filename)
  }

  let script: Script
  if (cached) {
    const mapComment = convertSourceMap.fromSource(cached)
    script = {
      code: convertSourceMap.removeComments(cached),
      map: mapComment?.toObject(),
    }
  } else {
    // Transform into JavaScript ESM.
    const lang = path.extname(filename)
    script = /\.m?js$/.test(lang)
      ? { code, map: undefined }
      : await transform(code, {
          format: 'esm',
          target: 'esnext',
          loader: lang.slice(1) as any,
          sourcemap: 'external',
          sourcefile: filename,
        })

    const esmHelpers = new Set<Function>()
    const editor = await compileEsm({
      code: script.code,
      filename,
      esmHelpers,
      forceLazyBinding: (_, id) =>
        !isPackageRef(id) ||
        (liveModulePaths &&
          moduleMap &&
          moduleMap.has(id) &&
          isLiveModule(moduleMap.get(id)!, liveModulePaths)),
    })

    editor.prepend(`async function $() { `)
    editor.append(`\n}`)

    // Apply the edits.
    script = overwriteScript(filename, script, {
      code: editor.toString(),
      map: editor.generateMap({ hires: true }),
    })

    // Ensure the module works in the current Node version.
    script = overwriteScript(
      filename,
      script,
      await transform(script.code, {
        format: 'cjs',
        target: 'node' + process.version.slice(1),
        loader: 'js',
        sourcemap: 'external',
        sourcefile: filename,
      })
    )

    // Remove the async wrapper used to enable top-level await.
    script.code = script.code.replace(/^async .+?\n/, '\n')

    // Append the ESM helpers for CJS compatibility.
    script.code = script.code.replace(
      /\}\n$/, // …and remove the async wrapper's closing brace.
      Array.from(esmHelpers, fn => fn.toString()).join('\n')
    )

    // Store the compiled module on disk with an inline source map.
    if (compileCache && filename[0] !== '\0') {
      compileCache.set(cacheKey, script.code + toInlineSourceMap(script.map!))
    }
  }
  return {
    ...script,
    id: filename,
    env,
    imports: new Set(),
    importers: new ImporterSet(),
    compileTime: Date.now() - time,
    requireTime: 0,
  }
}

async function transform(
  code: string,
  options: esbuild.TransformOptions
): Promise<Script> {
  const compiled = await esbuild.transform(code, options)
  const map = JSON.parse(compiled.map)
  resolveMapSources(map, process.cwd())
  return { code: compiled.code, map }
}

function lazyGlobRequire(
  globs: string[],
  importer: string,
  requireAsync: RequireAsync,
  watcher?: vite.FSWatcher
) {
  const modules: Record<string, any> = {}
  const roots = new Map<string, string[]>()

  const importerDir = path.dirname(importer)
  for (const input of globs) {
    const { base, glob } = toGlobBase(path.resolve(importerDir, input))

    let root = roots.get(base)
    if (root) {
      root.push(glob)
    } else {
      roots.set(base, [glob])
    }

    const files = crawl(base, {
      only: ['/' + glob],
      absolute: true,
    })

    for (const file of files) {
      let name = path.relative(importerDir, file)
      if (input.startsWith('./')) {
        name = './' + name
      }
      modules[name] = requireAsync.bind(null, '/@fs/' + file, importer, true)
    }
  }

  if (watcher) {
    const globWatchers: chokidar.FSWatcher[] = []
    const reloadImporter = () => {
      globWatchers.forEach(w => void w.close())
      watcher.emit('change', importer)
    }
    for (const [base, globs] of roots) {
      globWatchers.push(
        chokidar
          .watch(globs, {
            ignoreInitial: true,
            cwd: base,
          })
          .on('add', reloadImporter)
          .on('unlink', reloadImporter)
      )
    }
  }

  return modules
}
