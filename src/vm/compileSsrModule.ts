import fs from 'fs'
import { basename } from 'path'
import { SausContext, vite } from '../core'
import { cleanUrl } from '../utils/cleanUrl'
import { CompileCache } from '../utils/CompileCache'
import { isPackageRef } from '../utils/isPackageRef'
import { loadSourceMap, toInlineSourceMap } from '../utils/sourceMap'
import { toDevPath } from '../utils/toDevPath'
import {
  compileEsm,
  exportsId,
  importAsyncId,
  importMetaId,
  requireAsyncId,
} from './compileEsm'
import { ImporterSet } from './ImporterSet'
import { overwriteScript } from './overwriteScript'
import { CompiledModule, Script } from './types'

export async function compileSsrModule(
  id: string,
  context: SausContext
): Promise<CompiledModule | null> {
  const { config, server } = context
  const { pluginContainer } = server!

  let module = await readSsrModule(id, pluginContainer, context.compileCache)

  const importMeta = {
    url: toDevPath(id, context.root),
    env: {
      ...config.env,
      SSR: true,
    },
  }

  const importer = cleanUrl(id)
  const env = {
    [exportsId]: {},
    [importMetaId]: importMeta,
    [importAsyncId]: (id: string) => context.ssrRequire!(id, importer, true),
    [requireAsyncId]: (id: string) => context.ssrRequire!(id, importer, false),
  }

  const params = Object.keys(env).join(', ')
  return {
    code: `(0, async function(${params}) { ${module.code}\n})`,
    map: module.map,
    id,
    env,
    imports: new Set(),
    importers: new ImporterSet(),
  }
}

async function readSsrModule(
  id: string,
  pluginContainer: vite.PluginContainer,
  cache: CompileCache
) {
  const filename = cleanUrl(id)

  let loaded = await pluginContainer.load(id, { ssr: true })
  if (loaded == null) {
    loaded = fs.readFileSync(filename, 'utf8')
  }

  const cacheKey = cache.key(
    typeof loaded == 'string' ? loaded : loaded.code,
    'ssr/' + basename(filename)
  )

  const cached = cache.get(cacheKey, filename)
  if (cached !== undefined) {
    loaded = cached
  }

  let script = (
    typeof loaded == 'string'
      ? { code: loaded, map: loadSourceMap(loaded, filename) }
      : loaded
  ) as Script

  if (cached !== undefined) {
    return script
  }

  const transformed = await pluginContainer.transform(script.code, id, {
    inMap: script.map,
    ssr: true,
  })

  if (transformed?.code != null) {
    script = transformed as Script
  }

  if (script.map) {
    if (script.map.sources) {
      script.map.sources[0] = filename
    } else {
      script.map = undefined
    }
  }

  const esmHelpers = new Set<Function>()
  const editor = await compileEsm({
    code: script.code,
    filename,
    esmHelpers,
    forceLazyBinding: (_, id) => !isPackageRef(id),
  })

  editor.append(
    '\n' + Array.from(esmHelpers, fn => fn.toString() + '\n').join('')
  )

  script = overwriteScript(id, script, {
    code: editor.toString(),
    map: editor.generateMap({ hires: true }),
  })

  cache.set(cacheKey, script.code + toInlineSourceMap(script.map!))
  return script
}
