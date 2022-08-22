import { readFileSync } from 'fs'
import { basename } from 'path'
import { Promisable } from 'type-fest'
import type { CompileCache } from '../node/compileCache'
import { loadSourceMap, SourceMap, toInlineSourceMap } from '../node/sourceMap'
import { cleanUrl } from '../utils/cleanUrl'
import type { Script } from '../vm/types'
import type { ViteFunctions } from './functions'
import { overwriteScript } from './overwriteScript'

interface Options {
  /**
   * Perform a call-specific transformation after all plugin
   * transformations have been applied.
   */
  transform?: (
    code: string,
    id: string,
    inMap?: SourceMap
  ) => Promisable<Script>
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
  { transform, cache }: Options = {}
): Promise<Script> {
  const filename = cleanUrl(id)

  let code: string | undefined
  let script = ((await ctx.load(id)) || {
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

  if (transform) {
    const transformed = await transform(script.code, filename, script.map)
    script = overwriteScript(id, script, transformed)
  }

  if (cache && filename[0] !== '\0') {
    cache.set(cacheKey!, script.code + toInlineSourceMap(script.map!))
  }
  return script
}
