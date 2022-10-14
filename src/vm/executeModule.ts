import { isObject } from '@saus/deploy-utils'
import { cleanUrl } from '@utils/cleanUrl'
import { defer } from '@utils/defer'
import { toInlineSourceMap } from '@utils/node/sourceMap'
import { StackFrame } from '@utils/parseStackTrace'
import vm from 'vm'
import { exportsId, requireAsyncId } from './compileEsm'
import { __exportFrom as exportFrom } from './esmInterop'
import { exportNotFound } from './exportNotFound'
import { CompiledModule } from './types'

export function executeModule(
  module: CompiledModule,
  timeoutSecs?: number,
  requireStack?: (StackFrame | undefined)[]
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
      exports = exportFrom(exports, forwardedExports)
      env[exportFrom.name] = function __exportFrom(imported: any) {
        forwardedExports.unshift(imported)
      }
    }
    env[exportsId] = exports
  }

  const { promise, resolve, reject } = defer<any>()
  module.exports = promise
  module.requireStack = requireStack

  let timeout: NodeJS.Timeout | undefined
  if (timeoutSecs && !isCommonJS) {
    const onTimedOut = () => {
      reject(Error(`Module failed to load in ${timeoutSecs} secs: "${id}"`))
    }

    let timestamp = Date.now()
    let timeoutMs = timeoutSecs * 1000
    timeout = setTimeout(onTimedOut, timeoutMs)

    const resumeTimeout = (exports: any) => {
      if (timeoutMs > 0) {
        timeout = setTimeout(onTimedOut, timeoutMs)
      }
      return exports
    }

    const requireAsync = env[requireAsyncId] as (
      id: string,
      framesToPop: number
    ) => Promise<any>

    env[requireAsyncId] = (id: string) => {
      const now = Date.now()
      timeoutMs += timestamp - now
      timestamp = now
      clearTimeout(timeout)
      return requireAsync(id, 1).then(resumeTimeout)
    }
  }

  const params = Object.keys(env).join(', ')
  code = `(async function(${params}) { ${code}\n})`
  if (map) {
    code += toInlineSourceMap(map)
  }

  const init = vm.runInThisContext('"use strict";' + code, {
    filename: id[0] !== '\0' ? cleanUrl(id) : undefined,
  }) as (...env: any[]) => Promise<void>

  init(...Object.values(env))
    .then(() => {
      clearTimeout(timeout)

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
