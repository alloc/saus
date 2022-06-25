import { SausContext } from '..'
import { toDevPath } from '../node/toDevPath'
import { cleanUrl } from '../utils/cleanUrl'
import { isPackageRef } from '../utils/isPackageRef'
import { compileModule } from '../vite/compileModule'
import {
  compileEsm,
  exportsId,
  importAsyncId,
  importMetaId,
  requireAsyncId,
} from '../vm/compileEsm'
import { ImporterSet } from '../vm/ImporterSet'
import { CompiledModule } from '../vm/types'

export async function compileSsrModule(
  id: string,
  context: Omit<SausContext, 'command'>
): Promise<CompiledModule | null> {
  const { config } = context

  let module = await compileModule(id, context, {
    transform: ssrCompileEsm,
    cache: context.compileCache,
  })

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

async function ssrCompileEsm(code: string, id: string) {
  const esmHelpers = new Set<Function>()
  const editor = await compileEsm({
    code,
    filename: id,
    esmHelpers,
    forceLazyBinding: (_, id) => !isPackageRef(id),
  })

  editor.append(
    '\n' + Array.from(esmHelpers, fn => fn.toString() + '\n').join('')
  )

  return {
    code: editor.toString(),
    map: editor.generateMap({ hires: true }),
  }
}
