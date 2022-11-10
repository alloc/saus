import { cleanUrl } from '@utils/cleanUrl'
import { isPackageRef } from '@utils/isPackageRef'
import { servedPathForFile } from '@utils/node/servedPathForFile'
import { importAsyncId, importMetaId, requireAsyncId } from '@vm/compileEsm'
import { compileModule } from '@vm/compileModule'
import { ImporterSet } from '@vm/ImporterSet'
import { isLiveModule } from '@vm/isLiveModule'
import { CompiledModule } from '@vm/types'
import { Module } from 'module'
import path from 'path'
import { SausContext } from '../context'
import { checkPublicFile } from './checkPublicFile'

export async function compileSsrModule(
  id: string,
  context: SausContext,
  virtualId?: string,
  // This flag treats the module as both CommonJS and ESM. It's used
  // when a local module is imported (directly or not) by the routes
  // module, as it's impossible to infer whether the module will also be
  // imported by an SSR module (well… without eager import analysis).
  isHybrid?: boolean
): Promise<CompiledModule | null> {
  const { config, liveModulePaths, moduleMap } = context
  const time = Date.now()

  // The `compileModule` function must receive the resolved ID,
  // as it's expected by plugins with a load hook.
  const loadedId = id
  if (id == virtualId) {
    // But we want to use the absolute file path when dealing
    // with public files, or else we can't hot reload them.
    const publicFile = checkPublicFile(id, config)
    if (publicFile) {
      id = publicFile
    }
  }

  const module = await compileModule(loadedId, context, {
    cache: context.compileCache,
    esmOptions: {
      forceLazyBinding: (_, id) =>
        !isPackageRef(id) ||
        (liveModulePaths &&
          moduleMap.has(id) &&
          isLiveModule(moduleMap.get(id)!, liveModulePaths)),
    },
  })

  const importer = cleanUrl(id)

  let env: Record<string, any>
  if (isHybrid || module.isCommonJS) {
    env = {
      require: Module.createRequire(importer),
      __dirname: path.dirname(importer),
      __filename: importer,
    }
  } else {
    env = {}
  }

  if (isHybrid || !module.isCommonJS) {
    const require = isHybrid ? context.require : context.ssrRequire
    env[requireAsyncId] = (id: string, framesToPop = 0) =>
      require(id, importer, false, framesToPop + 1)
    env[importAsyncId] = (id: string) => require(id, importer, true, 1)
    env[importMetaId] = {
      url: servedPathForFile(id, context.root),
      env: {
        ...config.env,
        SSR: true,
      },
    }
  }

  return {
    code: module.code,
    map: module.map,
    id,
    env,
    imports: new Set(),
    importers: new ImporterSet(),
    compileTime: Date.now() - time,
    requireTime: 0,
  }
}
