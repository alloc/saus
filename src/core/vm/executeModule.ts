import vm from 'vm'
import { toInlineSourceMap } from '../node/sourceMap'
import { cleanUrl } from '../utils/cleanUrl'
import { exportsId } from './compileEsm'
import { __exportFrom as exportFrom } from './esmInterop'
import { exportNotFound } from './exportNotFound'
import { CompiledModule } from './types'

export function executeModule(module: CompiledModule): Promise<any> {
  if (!module.code) {
    return module.exports!
  }

  let { id, code, map, env } = module

  env[exportsId] = Object.create(exportNotFound(id))
  if (/^\s*__exportFrom\b/m.test(module.code)) {
    const forwardedExports: any[] = []
    env[exportsId] = exportFrom(env[exportsId], forwardedExports)
    env[exportFrom.name] = function __exportFrom(imported: any) {
      forwardedExports.unshift(imported)
    }
  }

  const params = Object.keys(env).join(', ')
  code = `(0, async function(${params}) { ${code}\n})`
  if (map) {
    code += toInlineSourceMap(map)
  }

  const init = vm.runInThisContext('"use strict";' + code, {
    filename: id[0] !== '\0' ? cleanUrl(id) : undefined,
  })

  const exports = env[exportsId]
  return (module.exports = init(...Object.values(env)).then(() => {
    Object.defineProperty(exports, '__esModule', { value: true })
    return exports
  }))
}
