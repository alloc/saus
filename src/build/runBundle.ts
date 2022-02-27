import path from 'path'
import vm from 'vm'
import { RenderPageOptions } from '../bundle/types'
import { loadSourceMap, removeSourceMapUrls } from '../core'
import { resolveStackTrace } from '../utils/resolveStackTrace'

export function runBundle({
  code,
  filename,
}: {
  code: string
  filename: string
}) {
  const initialize: (exports: any, require: Function) => void =
    vm.runInThisContext(
      `(0, function(exports,require) {` +
        removeSourceMapUrls(code) +
        `\n})\n//# sourceMappingURL=${path.basename(filename)}.map\n`,
      { filename }
    )

  const exports: any = {}
  initialize(exports, require)

  const renderPage = exports.default
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
