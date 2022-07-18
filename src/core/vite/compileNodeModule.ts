import * as convertSourceMap from 'convert-source-map'
import * as esbuild from 'esbuild'
import { Module } from 'module'
import path from 'path'
import { CompileCache } from '../node/compileCache'
import { resolveMapSources, toInlineSourceMap } from '../node/sourceMap'
import { isPackageRef } from '../utils/isPackageRef'
import {
  compileEsm,
  exportsId,
  importAsyncId,
  importMetaId,
  requireAsyncId,
} from '../vm/compileEsm'
import { ImporterSet } from '../vm/ImporterSet'
import { isLiveModule } from '../vm/isLiveModule'
import { CompiledModule, ModuleMap, RequireAsync, Script } from '../vm/types'
import { overwriteScript } from './overwriteScript'

export async function compileNodeModule(
  code: string,
  filename: string,
  requireAsync: RequireAsync,
  {
    compileCache,
    importMeta,
    liveModulePaths,
    moduleMap,
  }: {
    compileCache?: CompileCache | null
    importMeta?: Record<string, any>
    liveModulePaths?: Set<string>
    moduleMap?: ModuleMap
  } = {}
): Promise<CompiledModule> {
  const env = {
    require: Module.createRequire(filename),
    __dirname: path.dirname(filename),
    __filename: filename,
    [exportsId]: {},
    [importMetaId]: { env: { ...importMeta, SSR: true } },
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
          moduleMap[id] &&
          isLiveModule(moduleMap[id]!, liveModulePaths)),
    })

    const topLevelId = '__compiledModule'
    const eofLineBreak = script.code.endsWith('\n') ? '' : '\n'

    editor.prepend(`async function ${topLevelId}(__env) { `)
    editor.append(eofLineBreak + `}`)

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

    // Inject the local environment after compiling with Esbuild to avoid
    // renaming the `require` variable to `require2` which is wrong.
    script.code = script.code.replace('__env', Object.keys(env).join(', '))

    // Append ESM helpers needed for CJS compatibility.
    script.code += Array.from(esmHelpers, fn => fn.toString()).join('\n')

    // Wrap in an IIFE that returns the module factory.
    script.code = `(function() { ${script.code}\nreturn ${topLevelId}\n})()`

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
