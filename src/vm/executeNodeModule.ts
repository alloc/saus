import fs from 'fs'
import { resolve } from 'path'
import { createAsyncRequire } from './asyncRequire'
import { compileNodeModule } from './compileNodeModule'
import { executeModule } from './executeModule'
import { ModuleMap } from './types'

const relativePathRE = /^(?:\.\/|(\.\.\/)+)/

export async function executeNodeModule(
  code: string,
  filename: string,
  moduleMap: ModuleMap = {},
  importMeta?: Record<string, any>
) {
  const requireAsync = createAsyncRequire({
    moduleMap,
    resolveId(id, importer) {
      // Relative paths are compiled.
      if (relativePathRE.test(id)) {
        return resolve(importer, '..', id)
      }
    },
    compileModule: (id, requireAsync) =>
      compileNodeModule(
        fs.readFileSync(id, 'utf8'),
        id,
        requireAsync,
        null,
        importMeta
      ),
  })
  const module = await compileNodeModule(
    code,
    filename,
    requireAsync,
    null,
    importMeta
  )
  return executeModule(module)
}
