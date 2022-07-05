import { isLiveModule } from '@/vm/isLiveModule'
import { SausContext } from '..'
import { servedPathForFile } from '../node/servedPathForFile'
import { cleanUrl } from '../utils/cleanUrl'
import { isPackageRef } from '../utils/isPackageRef'
import { compileModule } from '../vite/compileModule'
import {
  compileEsm,
  EsmCompilerOptions,
  exportsId,
  importAsyncId,
  importMetaId,
  requireAsyncId,
} from '../vm/compileEsm'
import { ImporterSet } from '../vm/ImporterSet'
import { CompiledModule } from '../vm/types'

export async function compileSsrModule(
  id: string,
  context: SausContext
): Promise<CompiledModule | null> {
  const { config, liveModulePaths, moduleMap } = context

  let module = await compileModule(id, context, {
    cache: context.compileCache,
    transform: ssrCompileEsm({
      forceLazyBinding: (_, id) =>
        !isPackageRef(id) ||
        (liveModulePaths &&
          moduleMap[id] &&
          isLiveModule(moduleMap[id]!, liveModulePaths)),
    }),
  })

  const importMeta = {
    url: servedPathForFile(id, context.root),
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

function ssrCompileEsm(esmOptions: Partial<EsmCompilerOptions>) {
  return async (code: string, id: string) => {
    const esmHelpers = new Set<Function>()
    const editor = await compileEsm({
      ...esmOptions,
      code,
      filename: id,
      esmHelpers,
    })

    editor.append(
      '\n' + Array.from(esmHelpers, fn => fn.toString() + '\n').join('')
    )

    return {
      code: editor.toString(),
      map: editor.generateMap({ hires: true }),
    }
  }
}
