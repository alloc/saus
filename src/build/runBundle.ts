import path from 'path'
import vm from 'vm'
import { removeSourceMapUrls } from '../utils/sourceMap'

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
  return exports as typeof import('../bundle/main')
}
