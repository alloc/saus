import { isObject } from '@saus/deploy-utils'
import vm from 'vm'
import { toInlineSourceMap } from '../node/sourceMap'
import { cleanUrl } from '../utils/cleanUrl'
import { defer } from '../utils/defer'
import { exportsId, requireAsyncId } from './compileEsm'
import { __exportFrom as exportFrom } from './esmInterop'
import { exportNotFound } from './exportNotFound'
import {
  kModuleSetTimeout,
  kModuleTimeout,
  kModuleTimeoutCallback,
  kModuleTimeoutSecs,
  setModuleTimeout,
} from './moduleTimeout'
import { CompiledModule } from './types'

export function executeModule(
  module: CompiledModule,
  timeout?: number
): Promise<any> {
  if (!module.code) {
    return module.exports!
  }

  let { id, code, map, env } = module
  let exports: any

  const isCommonJS = !!env.require && !env[requireAsyncId]
  if (isCommonJS) {
    env.module = {
      exports: (env.exports = exports = {}),
    }
  } else {
    exports = Object.create(exportNotFound(id))
    if (/^\s*__exportFrom\b/m.test(module.code)) {
      const forwardedExports: any[] = []
      env[exportsId] = exportFrom(exports, forwardedExports)
      env[exportFrom.name] = function __exportFrom(imported: any) {
        forwardedExports.unshift(imported)
      }
    } else {
      env[exportsId] = exports
    }
  }

  const { promise, resolve, reject } = defer<any>()
  module.exports = promise

  if (timeout) {
    env[kModuleSetTimeout] = setModuleTimeout
    exports[kModuleTimeoutSecs] = timeout
    exports[kModuleTimeoutCallback] = () => {
      reject(Error(`Module failed to load in ${timeout} secs: "${id}"`))
    }
  }

  const params = Object.keys(env).join(', ')
  code = `(async function(${params}) { ${code}\n})`
  if (map) {
    code += toInlineSourceMap(map)
  }

  const init = vm.runInThisContext('"use strict";' + code, {
    filename: id[0] !== '\0' ? cleanUrl(id) : undefined,
  })

  init(...Object.values(env))
    .then(() => {
      if (timeout) {
        clearTimeout(exports[kModuleTimeout])
        exports[kModuleTimeout] = undefined
      }

      if (isCommonJS) {
        // Use the `module.exports` property as the ESM exports
        // if it equals a plain object. Otherwise, it gets wrapped
        // as the `default` export.
        exports = env.module.exports
        exports = isObject(exports) ? exports : {}

        // Return early if compiled from ESM syntax
        if (exports.hasOwnProperty('__esModule')) {
          return resolve(exports)
        }

        if (!exports.hasOwnProperty('default')) {
          Object.defineProperty(exports, 'default', {
            value: env.module.exports,
          })
        }
      }

      Object.defineProperty(exports, '__esModule', { value: true })
      resolve(exports)
    })
    .catch(reject)

  return promise
}
