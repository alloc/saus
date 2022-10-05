import * as esModuleLexer from 'es-module-lexer'
import { readFileSync } from 'fs'
import { basename } from 'path'
import type { CompileCache } from '../node/compileCache'
import { loadSourceMap, toInlineSourceMap } from '../node/sourceMap'
import { cleanUrl } from '../utils/cleanUrl'
import { compileEsm, EsmCompilerOptions } from '../vm/compileEsm'
import type { Script } from '../vm/types'
import type { ViteFunctions } from './functions'
import { overwriteScript } from './overwriteScript'

interface Options {
  /**
   * When defined, the module is compiled from ESM to CJS.
   */
  esmOptions?: Partial<EsmCompilerOptions>
  /**
   * Store the transformed code and its sourcemap
   * in a single file somewhere on disk.
   */
  cache?: CompileCache
}

/**
 * Using the `load` and `transform` hooks of your configured
 * Vite plugins, fetch and compile the module associated with
 * the given `id` and return its code/sourcemap.
 */
export async function compileModule(
  id: string,
  ctx: Pick<ViteFunctions, 'load' | 'transform'>,
  { esmOptions, cache }: Options = {}
): Promise<Script> {
  const filename = cleanUrl(id)
  const loaded = await ctx.load(id)

  let code: string | undefined
  let script = (loaded || {
    code: (code = readFileSync(filename, 'utf8')),
    map: loadSourceMap(code, filename),
  }) as Script

  let cacheKey: string
  let cached: string | undefined

  if (cache && filename[0] !== '\0') {
    cacheKey = cache.key(script.code, 'ssr/' + basename(filename))

    cached = cache.get(cacheKey, filename)
    if (cached !== undefined) {
      script = {
        code: cached,
        map: loadSourceMap(cached, filename),
      }
    }
  }

  if (cached !== undefined) {
    return script
  }

  // For JS files loaded from the filesystem...
  if (filename.endsWith('.js') && (!loaded || loaded.meta?.filename)) {
    // Look for evidence of ESM syntax.
    const [imports, exports] = esModuleLexer.parse(script.code)
    if (!imports.length && !exports.length) {
      // Likely a CommonJS module from a linked dependency.
      script.isCommonJS = true
      return script
    }
  }

  const transformed = await ctx.transform(script.code, id, script.map)
  if (typeof transformed == 'string') {
    script.code = transformed
  } else if (transformed?.code != null) {
    script = transformed as Script
  }

  if (script.map) {
    if (script.map.sources) {
      script.map.sources[0] = filename
    } else {
      script.map = undefined
    }
  }

  if (esmOptions) {
    const esmHelpers = new Set<Function>()
    const editor = await compileEsm({
      ...esmOptions,
      code: script.code,
      filename: id,
      esmHelpers,
    })

    editor.append(
      '\n' + Array.from(esmHelpers, fn => fn.toString() + '\n').join('')
    )

    script = overwriteScript(id, script, {
      code: editor.toString(),
      map: editor.generateMap({ hires: true }),
    })
  }

  if (cache && filename[0] !== '\0') {
    cache.set(cacheKey!, script.code + toInlineSourceMap(script.map!))
  }
  return script
}
