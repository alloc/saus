import vm from 'vm'
import { resolveStackTrace } from '../utils/resolveStackTrace'
import { SourceMap, toInlineSourceMap } from '../utils/sourceMap'

export function runBundle({
  code,
  map,
  filename,
}: {
  code: string
  map: SourceMap | undefined
  filename: string
}) {
  const onError = (error: any) => {
    if (map && error && error.stack) {
      error.stack = resolveStackTrace(error.stack, code, map)
    }
    throw error
  }

  const catchRenderExceptions =
    (renderPage: (arg: any) => Promise<any>) => async (arg: any) => {
      try {
        const page = await renderPage(arg)
        return page
      } catch (error: any) {
        onError(error)
      }
    }

  const bundle: any = {}
  try {
    const initialize: (exports: any, require: Function) => void =
      vm.runInThisContext(
        `(0, function(exports,require) {${code}\n})` +
          (map ? toInlineSourceMap(map) : ''),
        { filename }
      )

    initialize(bundle, require)
  } catch (error: any) {
    onError(error)
  }

  return catchRenderExceptions(bundle.default)
}
