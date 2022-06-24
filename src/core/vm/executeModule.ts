import vm from 'vm'
import { toInlineSourceMap } from '../node/sourceMap'
import { cleanUrl } from '../utils/cleanUrl'
import { exportsId } from './compileEsm'
import { CompiledModule } from './types'

export function executeModule(module: CompiledModule): Promise<any> {
  let { id, code, map, env } = module
  if (map) {
    code += toInlineSourceMap(map)
  }
  const init = vm.runInThisContext(code, {
    filename: id[0] !== '\0' ? cleanUrl(id) : undefined,
  })
  return (module.exports = init(...Object.values(env)).then(() => {
    const exports = env[exportsId]
    Object.defineProperty(exports, '__esModule', { value: true })
    return exports
  }))
}
