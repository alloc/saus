import { Module } from 'module'
import { isLiveModule } from '@/vm/isLiveModule'
import { SausContext } from '..'
import { servedPathForFile } from '../node/servedPathForFile'
import { cleanUrl } from '../utils/cleanUrl'
import { isPackageRef } from '../utils/isPackageRef'
import { compileModule } from '../vite/compileModule'
import {
  compileEsm,
  EsmCompilerOptions,
  importAsyncId,
  importMetaId,
  requireAsyncId,
} from '../vm/compileEsm'
import { ImporterSet } from '../vm/ImporterSet'
import { CompiledModule } from '../vm/types'
import { checkPublicFile } from './checkPublicFile'

export async function compileSsrModule(
  id: string,
  context: SausContext,
  virtualId?: string
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
    transform: ssrCompileEsm({
      forceLazyBinding: (_, id) =>
        !isPackageRef(id) ||
        (liveModulePaths &&
          moduleMap[id] &&
          isLiveModule(moduleMap[id]!, liveModulePaths)),
    }),
  })

  const importer = cleanUrl(id)

  let env: Record<string, any>
  if (module.isCommonJS) {
    env = {
      require: Module.createRequire(importer),
    }
  } else {
    env = {
      [requireAsyncId]: (id: string) => context.ssrRequire(id, importer, false),
      [importAsyncId]: (id: string) => context.ssrRequire(id, importer, true),
      [importMetaId]: {
        url: servedPathForFile(id, context.root),
        env: {
          ...config.env,
          SSR: true,
        },
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
