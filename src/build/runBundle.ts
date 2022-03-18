import path from 'path'
import vm from 'vm'
import { RenderPageOptions } from '../bundle/types'
import {
  loadSourceMap,
  MutableRuntimeConfig,
  removeSourceMapUrls,
} from '../core'
import { loadResponseCache, responseCache } from '../http/responseCache'
import { resolveStackTrace } from '../utils/resolveStackTrace'

export interface BundleDescriptor {
  root: string
  code: string
  filename: string
  runtimeConfig?: Partial<MutableRuntimeConfig> | false
}

export function runBundle(bundle: BundleDescriptor) {
  const { root, code, filename } = bundle

  const initialize: (exports: any, require: Function) => void =
    vm.runInThisContext(
      `(0, function(exports,require) {` +
        removeSourceMapUrls(code) +
        `\n})\n//# sourceMappingURL=${path.basename(filename)}.map\n`,
      { filename }
    )

  const exports: any = {}
  initialize(exports, require)

  const {
    default: renderPage,
    configureBundle,
    setResponseCache,
  } = exports as typeof import('../bundle/main')

  if (bundle.runtimeConfig) {
    configureBundle(bundle.runtimeConfig)
  }

  // If a response cache already exists, the bundle will use it.
  setResponseCache(responseCache || loadResponseCache(root))

  return async (pagePath: string, options?: RenderPageOptions) => {
    try {
      return await renderPage(pagePath, options)
    } catch (e: any) {
      const map = loadSourceMap(code, filename)
      if (map) {
        e.stack = resolveStackTrace(e.stack, source => {
          return source == filename ? map : null
        })
      }
      throw e
    }
  }
}
