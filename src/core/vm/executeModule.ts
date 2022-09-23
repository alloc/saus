import { isObject } from '@saus/deploy-utils'
import vm from 'vm'
import { toInlineSourceMap } from '../node/sourceMap'
import { cleanUrl } from '../utils/cleanUrl'
import { exportsId, requireAsyncId } from './compileEsm'
import { __exportFrom as exportFrom } from './esmInterop'
import { exportNotFound } from './exportNotFound'
import { CompiledModule } from './types'

export function executeModule(module: CompiledModule): Promise<any> {
  if (!module.code) {
    return module.exports!
  }

  let { id, code, map, env } = module

  if (env.require && !env[requireAsyncId]) {
    env.module = {
      exports: (env.exports = {}),
    }
  } else {
    env[exportsId] = Object.create(exportNotFound(id))
    if (/^\s*__exportFrom\b/m.test(module.code)) {
      const forwardedExports: any[] = []
      env[exportsId] = exportFrom(env[exportsId], forwardedExports)
      env[exportFrom.name] = function __exportFrom(imported: any) {
        forwardedExports.unshift(imported)
      }
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

  let exports = env[exportsId]
  return (module.exports = init(...Object.values(env)).then(() => {
    if (!exports) {
      // Use the `module.exports` property as the ESM exports
      // if it equals a plain object. Otherwise, it gets wrapped
      // as the `default` export.
      exports = env.module.exports
      exports = isObject(exports) ? exports : {}

      // Return early if compiled from ESM syntax
      if (exports.hasOwnProperty('__esModule')) {
        return exports
      }

      if (!exports.hasOwnProperty('default')) {
        Object.defineProperty(exports, 'default', {
          value: env.module.exports,
        })
      }
    }

    Object.defineProperty(exports, '__esModule', { value: true })
    return exports
  }))
}
