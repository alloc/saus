import path from 'path'
import vm from 'vm'
import { RenderPageOptions } from '../bundle/types'
import { loadSourceMap, removeSourceMapUrls, toInlineSourceMap } from '../core'
import { resolveStackTrace } from '../utils/resolveStackTrace'

export function runBundle({
  code,
  filename,
}: {
  code: string
  filename: string
}) {
  const map = loadSourceMap(code, filename)!

  const initialize: (exports: any, require: Function) => void =
    vm.runInThisContext(
      `(0, function(exports,require) {` +
        removeSourceMapUrls(code) +
        `\n})\n//# sourceMappingURL=${path.basename(filename)}.map`,
      { filename, lineOffset: -1 }
    )

  const exports: any = {}
  initialize(exports, require)

  const renderPage = exports.default
  return async (pagePath: string, options?: RenderPageOptions) => {
    try {
      return await renderPage(pagePath, options)
    } catch (e: any) {
      console.log(e.stack)
      e.stack = resolveStackTrace(e.stack, code, map)
      throw e
    }
  }
}
